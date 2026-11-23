import { Hono, type Context } from 'hono'
import {
  HEADER_KEY,
  HEADER_NONCE,
  HEADER_SIG,
  HEADER_TS,
  HEADER_SIM_EGRESS_IP,
  CLIP_MAX_SECONDS,
  LOG_UPLOAD_MAX_BYTES,
  MEDIA_SEGMENT_MAX_BYTES,
  NONCE_TTL_MS,
  SITE_ID_PATTERN,
  deriveSiteSecret,
  verifySignature,
  type CommandEnvelope,
  type CommandRecord,
  type CommandsResponse,
  type HeartbeatResponse,
  type LogFile,
  type LogUploadRequest,
  type LogUploadSummary,
  type MediaSessionInfo,
  type NvrIndex,
  type TrafficEntry,
  type HeartbeatLog,
  type IpChange,
  type SiteConnection,
  type SitePlan,
  type SiteSummary,
} from '@gh/iot-contract'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { z } from 'zod'
import type { GatewayConfig } from './config'
import { decryptJson, encryptJson, planHash } from './crypto'
import type { Realtime } from './realtime'
import * as S from './schemas'
import type { SiteRow, Store } from './store/types'

export interface Deps {
  cfg: GatewayConfig
  store: Store
  rt: Realtime
  now?: () => Date
}

type Env = { Variables: { siteId: string; site: SiteRow; body: string; bin: Uint8Array; trafficSite: string; note: string; resBytes: number; ip: string } }

/** 連線紀錄保留 */
const IP_HISTORY_KEEP = 50
const HEARTBEAT_KEEP = 120
const CONN_TTL_MS = 7 * 86_400_000

/** 場館的來源 IP：模擬器（-sim）可宣告浮動 IP；其餘看 DO 負載平衡器標頭，最後才用 socket 位址 */
function clientIp(c: Context<Env>, siteId: string): { ip: string; simulated: boolean } {
  const sim = c.req.header(HEADER_SIM_EGRESS_IP)
  if (sim && siteId.endsWith('-sim') && /^[0-9a-f.:]{3,45}$/i.test(sim)) return { ip: sim, simulated: true }
  const fwd = c.req.header('do-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const sock = (c.env as any)?.incoming?.socket?.remoteAddress as string | undefined
  return { ip: (fwd || sock || 'unknown').replace(/^::ffff:/, ''), simulated: false }
}

/** 影像片段上傳（二進位 body） */
const SEGMENT_PATH = /\/edge\/v1\/media\/[^/]+\/segments\/\d+$/
const MEDIA_RATE_PER_MIN = 1_200
const SEGMENT_TYPES = ['video/mp2t', 'video/mp4', 'image/jpeg']

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const fail = (status: number, code: string, message: string) => new HttpError(status, code, message)

/** 場館請求的 body 上限：一般 1 MB；log 上傳另計（JSON 跳脫會讓內容膨脹，留 1.5 倍＋64 KB） */
const EDGE_BODY_MAX = 1024 * 1024
const LOG_BODY_MAX = Math.ceil(LOG_UPLOAD_MAX_BYTES * 1.5) + 64 * 1024

function pathWithQuery(c: Context) {
  const u = new URL(c.req.url)
  return u.pathname + u.search
}

function parse<T extends z.ZodTypeAny>(schema: T, body: string): z.infer<T> {
  let json: unknown
  try {
    json = body ? JSON.parse(body) : {}
  } catch {
    throw fail(400, 'BAD_JSON', 'JSON 格式錯誤')
  }
  const r = schema.safeParse(json)
  if (!r.success) throw fail(422, 'VALIDATION', r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  return r.data
}

function envelope(r: CommandRecord): CommandEnvelope {
  return { id: r.id, issuedAt: r.createdAt, expiresAt: r.expiresAt, requestedBy: r.requestedBy ?? undefined, command: r.command }
}

export function createApp({ cfg, store, rt, now = () => new Date() }: Deps) {
  const app = new Hono<Env>()

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400)
    console.error('[gateway] unhandled', err)
    return c.json({ error: { code: 'INTERNAL', message: '伺服器錯誤' } }, 500)
  })

  /** 驗章：場館用自己的派生金鑰；平台用 PLATFORM_SECRET */
  async function authenticate(c: Context<Env>, expect: 'edge' | 'platform') {
    const keyId = c.req.header(HEADER_KEY)
    if (!keyId) throw fail(401, 'UNAUTHENTICATED', '缺少簽章')
    let secret: string
    let site: SiteRow | null = null
    if (expect === 'platform') {
      if (keyId !== 'platform') throw fail(403, 'FORBIDDEN', '此 API 僅供平台呼叫')
      secret = cfg.platformSecret
    } else {
      if (!SITE_ID_PATTERN.test(keyId)) throw fail(401, 'UNAUTHENTICATED', '金鑰識別錯誤')
      site = await store.getSite(keyId)
      if (!site) throw fail(401, 'UNAUTHENTICATED', '場館未開通')
      c.set('trafficSite', site.siteId)
      if (site.disabled) throw fail(403, 'SITE_DISABLED', '場館已停用')
      secret = deriveSiteSecret(cfg.siteMasterKey, site.siteId, site.keyVersion)
    }
    const binary = expect === 'edge' && c.req.method === 'PUT' && SEGMENT_PATH.test(c.req.path)
    const max = expect === 'edge' ? (binary ? MEDIA_SEGMENT_MAX_BYTES : c.req.path.includes('/logs/') ? LOG_BODY_MAX : EDGE_BODY_MAX) : Infinity
    if (Number(c.req.header('content-length') ?? 0) > max) throw fail(413, 'PAYLOAD_TOO_LARGE', `內容超過上限 ${max} bytes`)
    const raw: string | Uint8Array = binary ? new Uint8Array(await c.req.arrayBuffer()) : await c.req.text()
    const size = typeof raw === 'string' ? Buffer.byteLength(raw) : raw.byteLength
    if (size > max) throw fail(413, 'PAYLOAD_TOO_LARGE', `內容超過上限 ${max} bytes`)
    const body = typeof raw === 'string' ? raw : ''
    if (typeof raw !== 'string') c.set('bin', raw)
    const v = verifySignature({
      secret,
      method: c.req.method,
      pathWithQuery: pathWithQuery(c),
      body: raw,
      headers: { ts: c.req.header(HEADER_TS), nonce: c.req.header(HEADER_NONCE), sig: c.req.header(HEADER_SIG) },
      now: now().getTime(),
    })
    if (!v.ok) throw fail(401, v.reason, v.reason === 'CLOCK_SKEW' ? '時間誤差超過 5 分鐘，請校時（NTP）' : '簽章驗證失敗')
    if (!(await rt.claimNonce(`${keyId}:${c.req.header(HEADER_NONCE)}`, NONCE_TTL_MS))) throw fail(401, 'REPLAY', '重複的請求')
    if (site) {
      // 影像片段另計，避免串流時吃掉控制用的額度
      const n = await rt.hit(`${binary ? 'media' : 'site'}:${site.siteId}`, 60_000)
      if (n > (binary ? MEDIA_RATE_PER_MIN : cfg.rateLimitPerMin)) throw fail(429, 'RATE_LIMITED', '請求過於頻繁')
      c.set('site', site)
      c.set('siteId', site.siteId)
      const { ip, simulated } = clientIp(c, site.siteId)
      c.set('ip', ip)
      if (!binary) {
        const prev = await rt.swap(`ip:${site.siteId}`, ip, CONN_TTL_MS)
        if (prev !== ip) {
          const at = now().toISOString()
          const change: IpChange = { at, ip, prev, simulated }
          await rt.pushList(`iphist:${site.siteId}`, change, IP_HISTORY_KEEP, CONN_TTL_MS)
          if (prev) c.set('note', `來源 IP 變更 ${prev} → ${ip}${simulated ? '（模擬浮動 IP）' : ''}`)
        }
      }
    }
    c.set('body', body)
  }

  async function summary(s: SiteRow): Promise<SiteSummary> {
    return {
      siteId: s.siteId,
      name: s.name,
      venueId: s.venueId,
      disabled: s.disabled,
      keyVersion: s.keyVersion,
      online: await rt.isPresent(s.siteId),
      lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : null,
      agentVersion: s.agentVersion,
      planRev: s.planRev,
      status: s.status,
    }
  }

  async function expire(siteId: string, expired: CommandRecord[]) {
    for (const r of expired) await store.enqueueWebhook({ kind: 'command.expired', siteId, commandId: r.id, command: r.command })
  }

  // ───────────── 健康檢查（Load Balancer 用，不需驗證） ─────────────
  app.get('/healthz', (c) => c.json({ ok: true, instance: cfg.instanceId }))

  // ───────────── 場館電腦呼叫的 API ─────────────
  const edge = new Hono<Env>()
  edge.use('*', async (c, next) => {
    const t0 = Date.now()
    let status = 500
    try {
      await authenticate(c, 'edge')
      await next()
      status = c.res.status
    } catch (e) {
      status = e instanceof HttpError ? e.status : 500
      if (e instanceof HttpError) c.set('note', `${e.code}：${e.message}`)
      throw e
    } finally {
      const siteId = c.get('trafficSite')
      const seg = c.req.path.match(/\/segments\/(\d+)$/)
      // 影像片段太多：成功的只記每 15 片一筆
      if (siteId && !(seg && status < 400 && Number(seg[1]) % 15 !== 0)) {
        const down = c.req.method === 'GET'
        const entry: TrafficEntry = {
          at: new Date(t0).toISOString(),
          dir: down ? 'down' : 'up',
          method: c.req.method,
          path: c.req.path.replace(/^\/edge\/v1/, '') + (c.req.query('wait') ? `?wait=${c.req.query('wait')}` : ''),
          status,
          bytes: down ? (c.get('resBytes') ?? 0) : (c.get('bin')?.byteLength ?? Buffer.byteLength(c.get('body') ?? '')),
          ms: Date.now() - t0,
          note: c.get('note'),
        }
        void rt.pushTraffic(siteId, entry).catch(() => {})
      }
    }
  })

  edge.post('/heartbeat', async (c) => {
    const body = parse(S.heartbeat, c.get('body'))
    const siteId = c.get('siteId')
    const at = now()
    const prevSeen = c.get('site').lastSeenAt
    await rt.setPresence(siteId, cfg.offlineAfterSec * 1000)
    const { cameOnline } = await store.touchSite(siteId, at, body.agentVersion)
    if (cameOnline) await store.enqueueWebhook({ kind: 'presence', siteId, online: true, lastSeenAt: at.toISOString(), agentVersion: body.agentVersion })
    const site = (await store.getSite(siteId))!
    const res: HeartbeatResponse = { serverTime: at.toISOString(), planRev: site.planRev, clockSkewMs: Date.parse(body.localTime) - at.getTime() }
    const hb: HeartbeatLog = {
      at: at.toISOString(),
      ip: c.get('ip'),
      gapMs: prevSeen ? at.getTime() - new Date(prevSeen).getTime() : null,
      skewMs: res.clockSkewMs,
      uptimeSec: body.uptimeSec,
      planRev: body.planRev ?? null,
      pendingEvents: body.pendingEvents ?? 0,
      agentVersion: body.agentVersion,
    }
    await rt.pushList(`hb:${siteId}`, hb, HEARTBEAT_KEEP, CONN_TTL_MS)
    const prevNote = c.get('note')
    c.set('note', `${prevNote ? `${prevNote}・` : ''}IP ${hb.ip}・場館計畫 rev ${body.planRev ?? '—'}／雲端 rev ${site.planRev}・時差 ${res.clockSkewMs} ms${body.pendingEvents ? `・待送事件 ${body.pendingEvents}` : ''}`)
    return c.json(res)
  })

  edge.get('/plan', async (c) => {
    const p = await store.getPlan(c.get('siteId'))
    if (!p) throw fail(404, 'NO_PLAN', '平台尚未推送場館計畫')
    const etag = `"${p.rev}"`
    if (c.req.header('if-none-match') === etag) {
      c.set('note', `rev ${p.rev} 未變動`)
      return c.body(null, 304, { ETag: etag })
    }
    const plan = decryptJson<SitePlan>(cfg.dataKey, p.ciphertext)
    c.header('ETag', etag)
    c.header('Cache-Control', 'no-store')
    const text = JSON.stringify({ ...plan, rev: p.rev })
    c.set('resBytes', Buffer.byteLength(text))
    c.set('note', `rev ${p.rev}・${plan.circuits.length} 路・${plan.timeline.length} 段時段・${plan.doorCodes.length} 組密碼・${plan.overrides.length} 個手動`)
    return c.body(text, 200, { 'Content-Type': 'application/json; charset=utf-8' })
  })

  edge.get('/commands', async (c) => {
    const siteId = c.get('siteId')
    const waitSec = Math.max(0, Math.min(cfg.maxWaitSec, Number(c.req.query('wait') ?? 0) || 0))
    await rt.setPresence(siteId, cfg.offlineAfterSec * 1000)
    const take = async () => {
      const at = now()
      const r = await store.takeCommands(siteId, at, new Date(at.getTime() - cfg.redeliverAfterSec * 1000), 20)
      await expire(siteId, r.expired)
      return r.deliver
    }
    const respond = async (cmds: CommandRecord[]) => {
      const site = (await store.getSite(siteId))!
      const res: CommandsResponse = { serverTime: now().toISOString(), planRev: site.planRev, commands: cmds.map(envelope) }
      const text = JSON.stringify(res)
      c.set('resBytes', Buffer.byteLength(text))
      c.set('note', cmds.length ? cmds.map((r) => r.command.type).join('、') : '無指令')
      return c.body(text, 200, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    // 先開始等待再查詢，避免「查完之後、開始等之前」進來的指令被漏掉
    const ac = new AbortController()
    c.req.raw.signal?.addEventListener('abort', () => ac.abort(), { once: true })
    const planRevBefore = c.get('site').planRev
    const woke = waitSec > 0 ? rt.wait(siteId, waitSec * 1000, ac.signal) : Promise.resolve(false)
    let cmds = await take()
    if (cmds.length === 0 && waitSec > 0) {
      const site = await store.getSite(siteId)
      if (site && site.planRev === planRevBefore) {
        await woke
        if (!ac.signal.aborted) cmds = await take()
      }
    }
    ac.abort()
    return respond(cmds)
  })

  edge.post('/commands/:id/ack', async (c) => {
    const body = parse(S.ack, c.get('body'))
    const siteId = c.get('siteId')
    const r = await store.ackCommand(siteId, c.req.param('id'), body, now())
    if (!r) throw fail(404, 'NOT_FOUND', '找不到指令')
    c.set('note', `${r.command.type} → ${body.result}${body.error ? `（${body.error}）` : ''}`)
    if (r.ack && r.ack.at === body.at) {
      await store.enqueueWebhook({ kind: 'ack', siteId, commandId: r.id, command: r.command, ack: r.ack, requestedBy: r.requestedBy ?? undefined })
    }
    return c.json({ id: r.id, status: r.status })
  })

  edge.put('/status', async (c) => {
    const body = parse(S.status, c.get('body'))
    const siteId = c.get('siteId')
    await store.saveStatus(siteId, body, now())
    c.set('note', `ON：${Object.entries(body.circuits).filter(([, v]) => v === 'ON').map(([k]) => k).join(' ') || '無'}${body.hardware && (body.hardware.modbus !== 'OK' || body.hardware.doorController !== 'OK') ? '・硬體異常' : ''}`)
    await store.enqueueWebhook({ kind: 'status', siteId, status: body })
    return c.json({ ok: true })
  })

  edge.post('/events', async (c) => {
    const body = parse(S.events, c.get('body'))
    const siteId = c.get('siteId')
    const fresh = await store.insertEvents(siteId, body.events, now())
    c.set('note', `${body.events.length} 筆：${[...new Set(body.events.map((e) => e.type))].join('、')}${fresh.length < body.events.length ? `（重送 ${body.events.length - fresh.length}）` : ''}`)
    if (fresh.length) await store.enqueueWebhook({ kind: 'events', siteId, events: fresh })
    // 重送的也回 acked，地端才能清掉本機佇列
    return c.json({ acked: body.events.map((e) => e.eventId) })
  })

  /** 上傳 log.upload 指令要的本機 log（可重傳覆蓋），上傳後再 ack 該指令 */
  edge.put('/logs/:id', async (c) => {
    const body = parse(S.logUpload, c.get('body')) as LogUploadRequest
    const siteId = c.get('siteId')
    const cmd = await store.getCommand(c.req.param('id'))
    if (!cmd || cmd.siteId !== siteId) throw fail(404, 'NOT_FOUND', '找不到指令')
    if (cmd.command.type !== 'log.upload') throw fail(409, 'CONFLICT', '此指令不是 log.upload')
    if (cmd.status === 'QUEUED' || cmd.status === 'EXPIRED') throw fail(409, 'CONFLICT', `指令狀態 ${cmd.status}，不可上傳`)
    const asked = new Set<LogFile>(cmd.command.files)
    const bad = body.files.find((f) => !asked.has(f.name))
    if (bad) throw fail(422, 'VALIDATION', `未要求的檔案：${bad.name}`)
    const files = body.files.map((f) => ({ name: f.name, lines: f.lines, bytes: Buffer.byteLength(f.content), truncated: f.truncated }))
    const bytes = files.reduce((n, f) => n + f.bytes, 0)
    if (bytes > LOG_UPLOAD_MAX_BYTES) throw fail(413, 'PAYLOAD_TOO_LARGE', `log 合計超過 ${LOG_UPLOAD_MAX_BYTES} bytes，請截斷舊的部分並標 truncated`)
    const at = now()
    await store.saveLogUpload({ id: cmd.id, siteId, uploadedAt: at, bytes, files }, gzipSync(c.get('body')))
    await store.enqueueWebhook({ kind: 'log.uploaded', siteId, commandId: cmd.id, bytes, files: files.map(({ name, lines, truncated }) => ({ name, lines, truncated })), requestedBy: cmd.requestedBy ?? undefined })
    return c.json({ id: cmd.id, bytes, files })
  })

  // ───────────── 影像 ─────────────
  const liveEnded = (m: MediaSessionInfo) => m.ended || (m.kind === 'live' && m.until !== null && Date.parse(m.until) < now().getTime() - 10_000)

  /** 上傳一個 HLS 片段（二進位）。?dur=片段秒數；Content-Type：video/mp2t、video/mp4 或 image/jpeg */
  edge.put('/media/:session/segments/:seq', async (c) => {
    const siteId = c.get('siteId')
    const m = await store.getMediaSession(c.req.param('session'))
    if (!m || m.siteId !== siteId) throw fail(404, 'NOT_FOUND', '找不到影像 session')
    if (liveEnded(m)) throw fail(409, 'MEDIA_ENDED', '此 session 已結束，請停止上傳')
    const seq = Number(c.req.param('seq'))
    const dur = Number(c.req.query('dur') ?? 2)
    if (!Number.isInteger(seq) || seq < 0 || seq > 100_000) throw fail(422, 'VALIDATION', 'seq 必須是 0 以上的整數')
    if (!(dur > 0 && dur <= 30)) throw fail(422, 'VALIDATION', 'dur 必須介於 0–30 秒')
    const type = (c.req.header('content-type') ?? '').split(';')[0].trim()
    if (!SEGMENT_TYPES.includes(type)) throw fail(415, 'UNSUPPORTED_MEDIA', `Content-Type 必須是 ${SEGMENT_TYPES.join(' / ')}`)
    const data = Buffer.from(c.get('bin') ?? new Uint8Array())
    if (data.length === 0) throw fail(422, 'VALIDATION', '片段是空的')
    const info = await store.putSegment(m.session, seq, dur, type, data, now())
    c.set('note', `${m.kind === 'live' ? '即時' : '錄影'} cam${m.camera} 片段 #${seq}（累計 ${info.segments} 片、${Math.round(info.bytes / 1024)} KB）`)
    return c.json({ session: m.session, seq, segments: info.segments })
  })

  /** 錄影調閱傳完（或即時串流停止） */
  edge.post('/media/:session/end', async (c) => {
    const body = parse(S.mediaEnd, c.get('body'))
    const siteId = c.get('siteId')
    const m = await store.getMediaSession(c.req.param('session'))
    if (!m || m.siteId !== siteId) throw fail(404, 'NOT_FOUND', '找不到影像 session')
    const r = (await store.endMediaSession(m.session, body.reason ?? 'COMPLETED'))!
    await store.enqueueWebhook({ kind: 'media.ended', siteId, session: m.session, camera: m.camera, mediaKind: m.kind, segments: r.segments, reason: body.reason })
    c.set('note', `cam${m.camera} ${m.kind} 結束：${r.segments} 片${body.reason ? `（${body.reason}）` : ''}`)
    return c.json({ session: m.session, segments: r.segments })
  })

  /** nvr.index 的回覆：錄影索引 */
  edge.put('/media/nvr-index/:id', async (c) => {
    const body = parse(S.nvrIndex, c.get('body')) as NvrIndex
    const siteId = c.get('siteId')
    const cmd = await store.getCommand(c.req.param('id'))
    if (!cmd || cmd.siteId !== siteId) throw fail(404, 'NOT_FOUND', '找不到指令')
    if (cmd.command.type !== 'nvr.index') throw fail(409, 'CONFLICT', '此指令不是 nvr.index')
    await store.saveNvrIndex(cmd.id, siteId, body, now())
    c.set('note', `${body.recordings.length} 段錄影・最早 ${body.oldest ?? '—'}`)
    return c.json({ id: cmd.id, recordings: body.recordings.length })
  })

  app.route('/edge/v1', edge)

  // ───────────── 平台（Vercel）呼叫的內部 API ─────────────
  const internal = new Hono<Env>()
  internal.use('*', async (c, next) => {
    await authenticate(c, 'platform')
    await next()
  })

  const siteParam = (c: Context<Env>) => {
    const id = c.req.param('siteId') ?? ''
    if (!SITE_ID_PATTERN.test(id)) throw fail(422, 'VALIDATION', 'siteId 格式：小寫英數與連字號 3–40 字')
    return id
  }
  const mustSite = async (id: string) => {
    const s = await store.getSite(id)
    if (!s) throw fail(404, 'NOT_FOUND', '場館不存在')
    return s
  }

  internal.get('/sites', async (c) => c.json({ sites: await Promise.all((await store.listSites()).map(summary)) }))
  internal.get('/sites/:siteId', async (c) => c.json(await summary(await mustSite(siteParam(c)))))
  internal.put('/sites/:siteId', async (c) => {
    const body = parse(S.upsertSite, c.get('body'))
    return c.json(await summary(await store.upsertSite(siteParam(c), { name: body.name, venueId: body.venueId ?? null })))
  })

  /** 取得場館金鑰（開通時交給場館電腦）。rotate=true 先換新版本，舊金鑰立即失效 */
  internal.post('/sites/:siteId/credentials', async (c) => {
    const id = siteParam(c)
    const s = await mustSite(id)
    const rotate = c.req.query('rotate') === 'true'
    const keyVersion = rotate ? await store.bumpKeyVersion(id) : s.keyVersion
    return c.json({ siteId: id, keyVersion, secret: deriveSiteSecret(cfg.siteMasterKey, id, keyVersion) })
  })
  internal.post('/sites/:siteId/disable', async (c) => {
    const id = siteParam(c)
    await mustSite(id)
    await store.setDisabled(id, true)
    await rt.notify(id)
    return c.json({ ok: true })
  })
  internal.post('/sites/:siteId/enable', async (c) => {
    const id = siteParam(c)
    await mustSite(id)
    await store.setDisabled(id, false)
    return c.json({ ok: true })
  })

  internal.put('/sites/:siteId/plan', async (c) => {
    const id = siteParam(c)
    await mustSite(id)
    const plan = parse(S.sitePlan, c.get('body')) as SitePlan
    if (plan.siteId !== id) throw fail(422, 'VALIDATION', 'plan.siteId 與網址不符')
    const r = await store.putPlan(id, planHash(plan as unknown as Record<string, unknown>), encryptJson(cfg.dataKey, plan), now())
    if (r.changed) await rt.notify(id)
    return c.json(r)
  })

  internal.post('/sites/:siteId/commands', async (c) => {
    const id = siteParam(c)
    const site = await mustSite(id)
    if (site.disabled) throw fail(409, 'SITE_DISABLED', '場館已停用')
    const body = parse(S.enqueueCommand, c.get('body'))
    const cmd = body.command
    if ((cmd.type === 'log.upload' || cmd.type === 'nvr.index' || cmd.type === 'nvr.clip') && Date.parse(cmd.from) >= Date.parse(cmd.to)) throw fail(422, 'VALIDATION', 'command.from 必須早於 command.to')
    if (cmd.type === 'nvr.clip' && Date.parse(cmd.to) - Date.parse(cmd.from) > CLIP_MAX_SECONDS * 1000) throw fail(422, 'VALIDATION', `錄影調閱一次最多 ${CLIP_MAX_SECONDS / 60} 分鐘`)
    const at = now()
    if (cmd.type === 'camera.live' || cmd.type === 'nvr.clip') {
      const existing = await store.getMediaSession(cmd.session)
      if (existing && existing.siteId !== id) throw fail(409, 'CONFLICT', 'session 已被其他場館使用')
      await store.upsertMediaSession({
        session: cmd.session,
        siteId: id,
        kind: cmd.type === 'camera.live' ? 'live' : 'clip',
        camera: cmd.camera,
        createdAt: at,
        until: cmd.type === 'camera.live' ? new Date(at.getTime() + cmd.seconds * 1000) : null,
        from: cmd.type === 'nvr.clip' ? new Date(cmd.from) : null,
        to: cmd.type === 'nvr.clip' ? new Date(cmd.to) : null,
      })
    }
    if (cmd.type === 'camera.stop') await store.endMediaSession(cmd.session, 'STOPPED')
    const { record, created } = await store.enqueueCommand({
      id: body.id,
      siteId: id,
      command: body.command,
      requestedBy: body.requestedBy ?? null,
      createdAt: at,
      expiresAt: new Date(at.getTime() + (body.ttlSec ?? cfg.defaultCommandTtlSec) * 1000),
    })
    if (record.siteId !== id) throw fail(409, 'CONFLICT', '指令 ID 已被其他場館使用')
    if (created) await rt.notify(id)
    return c.json(record, created ? 201 : 200)
  })
  internal.get('/sites/:siteId/commands', async (c) => {
    const id = siteParam(c)
    const limit = Math.min(200, Number(c.req.query('limit') ?? 50) || 50)
    return c.json({ commands: await store.listCommands(id, limit) })
  })
  /** 最近的 log 調閱（含尚未上傳的）；上傳內容另用下面的 API 下載 */
  internal.get('/sites/:siteId/logs', async (c) => {
    const id = siteParam(c)
    const limit = Math.min(100, Number(c.req.query('limit') ?? 20) || 20)
    const reqs = (await store.listCommands(id, 500)).filter((r) => r.command.type === 'log.upload').slice(0, limit)
    const metas = new Map((await store.listLogUploads(id, reqs.map((r) => r.id))).map((m) => [m.id, m]))
    const logs: LogUploadSummary[] = reqs.map((r) => {
      const cmd = r.command as Extract<typeof r.command, { type: 'log.upload' }>
      const m = metas.get(r.id)
      return {
        id: r.id,
        siteId: r.siteId,
        status: r.status,
        requestedBy: r.requestedBy,
        createdAt: r.createdAt,
        from: cmd.from,
        to: cmd.to,
        files: cmd.files,
        minLevel: cmd.minLevel ?? null,
        error: r.ack?.error ?? null,
        upload: m ? { uploadedAt: m.uploadedAt.toISOString(), bytes: m.bytes, files: m.files } : null,
      }
    })
    return c.json({ logs })
  })
  /** 下載一個檔案的 JSON Lines 原文：?file=edge|audit|modbus */
  internal.get('/sites/:siteId/logs/:id', async (c) => {
    const id = siteParam(c)
    const file = c.req.query('file') as LogFile | undefined
    const r = await store.getLogUpload(id, c.req.param('id'))
    if (!r) throw fail(404, 'NOT_FOUND', '尚未上傳或已超過保存期限')
    const body = JSON.parse(gunzipSync(r.gz).toString('utf8')) as LogUploadRequest
    const f = body.files.find((x) => x.name === (file ?? body.files[0]?.name))
    if (!f) throw fail(404, 'NOT_FOUND', `這次上傳沒有 ${file}`)
    c.header('Content-Type', 'application/x-ndjson; charset=utf-8')
    c.header('Cache-Control', 'no-store')
    c.header('X-Log-Lines', String(f.lines))
    c.header('X-Log-Truncated', String(f.truncated))
    return c.body(f.content)
  })

  // ───────────── 影像（平台播放用） ─────────────
  const mustMedia = async (c: Context<Env>) => {
    const id = siteParam(c)
    const m = await store.getMediaSession(c.req.param('session') ?? '')
    if (!m || m.siteId !== id) throw fail(404, 'NOT_FOUND', '找不到影像 session')
    return m
  }
  internal.get('/sites/:siteId/media', async (c) => c.json({ sessions: await store.listMediaSessions(siteParam(c), Math.min(100, Number(c.req.query('limit') ?? 30) || 30)) }))
  internal.get('/sites/:siteId/media/:session', async (c) => {
    const m = await mustMedia(c)
    return c.json({ ...m, ended: liveEnded(m) })
  })
  /** HLS 播放清單：即時＝最近 6 片滑動視窗；錄影＝全部片段，傳完加 ENDLIST */
  internal.get('/sites/:siteId/media/:session/index.m3u8', async (c) => {
    const m = await mustMedia(c)
    let segs = await store.listSegments(m.session)
    if (m.kind === 'live') segs = segs.slice(-6)
    const ended = liveEnded(m)
    const target = Math.max(1, Math.ceil(Math.max(0, ...segs.map((s) => s.duration))))
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3', `#EXT-X-TARGETDURATION:${target}`, `#EXT-X-MEDIA-SEQUENCE:${segs[0]?.seq ?? 0}`]
    if (m.kind === 'clip' && ended) lines.push('#EXT-X-PLAYLIST-TYPE:VOD')
    for (const s of segs) lines.push(`#EXTINF:${s.duration.toFixed(3)},`, `${s.seq}.ts`)
    if (ended) lines.push('#EXT-X-ENDLIST')
    return c.body(lines.join('\n') + '\n', 200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' })
  })
  internal.get('/sites/:siteId/media/:session/:file', async (c) => {
    const m = await mustMedia(c)
    const seq = Number((c.req.param('file') ?? '').replace(/\.(ts|m4s|mp4|jpg)$/, ''))
    const seg = Number.isInteger(seq) ? await store.getSegment(m.session, seq) : null
    if (!seg) throw fail(404, 'NOT_FOUND', '片段不存在或已過期')
    return c.body(new Uint8Array(seg.data), 200, { 'Content-Type': seg.contentType, 'Cache-Control': m.kind === 'clip' ? 'private, max-age=3600' : 'no-store' })
  })
  internal.get('/sites/:siteId/nvr-index/:id', async (c) => {
    const id = siteParam(c)
    const r = await store.getNvrIndex(id, c.req.param('id'))
    if (!r) throw fail(404, 'NOT_FOUND', '場館尚未回覆錄影索引')
    return c.json({ uploadedAt: r.uploadedAt.toISOString(), ...r.body })
  })
  /** 場館最近的上行／下行請求（雲端端的流量紀錄） */
  internal.get('/sites/:siteId/traffic', async (c) => {
    const id = siteParam(c)
    return c.json({ traffic: await rt.getTraffic(id, Math.min(500, Number(c.req.query('limit') ?? 100) || 100)) })
  })

  /** 場館連線：目前來源 IP（浮動）、IP 變更歷史、最近心跳 */
  internal.get('/sites/:siteId/connection', async (c) => {
    const id = siteParam(c)
    const s = await store.getSite(id)
    if (!s) throw fail(404, 'NOT_FOUND', '場館不存在')
    const [hist, beats] = await Promise.all([
      rt.getList<IpChange>(`iphist:${id}`, IP_HISTORY_KEEP),
      rt.getList<HeartbeatLog>(`hb:${id}`, Math.min(HEARTBEAT_KEEP, Number(c.req.query('limit') ?? HEARTBEAT_KEEP) || HEARTBEAT_KEEP)),
    ])
    const cur = hist[0] ?? null
    const r: SiteConnection = {
      siteId: id,
      online: await rt.isPresent(id),
      lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : null,
      offlineAfterSec: cfg.offlineAfterSec,
      ip: cur?.ip ?? null,
      ipSince: cur?.at ?? null,
      simulated: cur?.simulated ?? false,
      ipHistory: hist,
      heartbeats: beats,
    }
    return c.json(r)
  })

  internal.get('/commands/:id', async (c) => {
    const r = await store.getCommand(c.req.param('id'))
    if (!r) throw fail(404, 'NOT_FOUND', '找不到指令')
    return c.json(r)
  })

  app.route('/internal/v1', internal)

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '找不到路徑' } }, 404))
  return app
}
