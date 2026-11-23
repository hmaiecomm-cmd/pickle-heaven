import { timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { EdgeAgent } from './agent'
import type { LogFile } from '../../../packages/iot-contract/src/index'

/**
 * 場館模擬器網頁（地端）：扮演場館電腦與所有設備，連到真正的 IoT Gateway。
 * 平台（雲端）做的每個操作都會在這裡看到；這裡的現場操作（輸入密碼、有人進場、故障）也會回報雲端。
 *
 *   GET  /                 主畫面
 *   GET  /api/state        設備與連線狀態
 *   GET  /api/plan         目前的場館計畫（?reveal=1 顯示門禁明碼，只在本機）
 *   GET  /api/traffic      上行／下行紀錄（?after=id）
 *   GET  /api/logs         本機 log（?file=edge|audit|modbus&tail=200）
 *   POST /api/action       現場操作與故障注入 { a, v }
 *   GET  /media/:session/* 本機預覽攝影機畫面（ffmpeg 產生的 HLS）
 *   GET  /healthz          健康檢查（雲端部署用，不需密碼）
 *
 * 放雲端時設 password：除 /healthz 外都要 HTTP Basic 驗證（帳號任意）。頁面用相對路徑，可掛在 /sim/ 之類的子路徑。
 */

export class OffsetClock {
  offsetMs = 0
  now() {
    return Date.now() + this.offsetMs
  }
}

const PAGE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'console.html')

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (c) => (s += c))
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function passwordOk(req: IncomingMessage, password: string) {
  const h = req.headers.authorization ?? ''
  if (!h.startsWith('Basic ')) return false
  const pass = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':').slice(1).join(':')
  const a = Buffer.from(pass)
  const b = Buffer.from(password)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function startConsole(agent: EdgeAgent, opts: { port: number; clock: OffsetClock; gatewayUrl: string; label?: string; platformUrl?: string; host?: string; password?: string; cloud?: boolean }) {
  const startedAt = Date.now()
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const json = (v: unknown, status = 200) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(v))
    if (url.pathname === '/healthz') return json({ ok: true, online: agent.online })
    if (opts.password && !passwordOk(req, opts.password)) return res.writeHead(401, { 'www-authenticate': 'Basic realm="IoT simulator", charset="UTF-8"' }).end('需要密碼')
    try {
      if (url.pathname === '/api/state') {
        const p = agent.plan
        const t = agent.now()
        return json({
          siteId: agent.opts.siteId,
          label: opts.label ?? null,
          gatewayUrl: opts.gatewayUrl,
          platformUrl: opts.platformUrl ?? null,
          online: agent.online,
          net: agent.net,
          offsetMs: opts.clock.offsetMs,
          localTime: new Date(t).toISOString(),
          uptimeSec: Math.round((Date.now() - startedAt) / 1000),
          planRev: agent.planRev,
          serverPlanRev: agent.serverPlanRev,
          lastError: agent.lastError,
          plan: p
            ? {
                rev: p.rev,
                generatedAt: p.generatedAt,
                window: p.window,
                intervals: p.timeline.length,
                codes: p.doorCodes.length,
                activeCodes: p.doorCodes.filter((c) => Date.parse(c.validFrom) <= t && t < Date.parse(c.validTo)).length,
                overrides: p.overrides.length,
                business: p.business,
                staleInHours: Math.round(((Date.parse(p.window.to) - t) / 3_600_000) * 10) / 10,
              }
            : null,
          circuits: (p?.circuits ?? []).map((d) => ({
            ...d,
            state: agent.hw.relays[d.channel],
            override: agent.overrides.get(d.no) ?? null,
            stuck: agent.hw.faults.stuckChannels?.includes(d.channel) ?? false,
            next: p ? nextChange(p.timeline.filter((i) => i.circuit === d.no), t) : null,
          })),
          door: { locked: agent.hw.doorLocked, unlocks: agent.hw.unlocks.slice(-10).reverse() },
          faults: agent.hw.faults,
          outbox: agent.outbox.length,
          executed: agent.executed.slice(-15).reverse(),
          played: agent.hw.played.slice(-12).reverse(),
          cameras: agent.cameras().map((c) => ({ ...c, scene: agent.scene(c) })),
          occupied: Object.fromEntries([...agent.occupied].filter(([, until]) => until > t)),
          media: agent.media?.summary() ?? null,
          trafficLast: agent.traffic.at(-1)?.id ?? 0,
          cloud: opts.cloud ?? false,
          floating: agent.floating,
          heartbeats: agent.heartbeats.slice(-40).reverse(),
          heartbeatMs: agent.opts.heartbeatMs,
        })
      }
      if (url.pathname === '/api/plan') {
        if (!agent.plan) return json(null)
        // 雲端版不顯示門禁明碼
        const reveal = url.searchParams.get('reveal') === '1' && !opts.cloud
        return json(reveal ? agent.plan : { ...agent.plan, doorCodes: agent.plan.doorCodes.map((c) => ({ ...c, code: `****${c.code.slice(-2)}` })) })
      }
      if (url.pathname === '/api/traffic') {
        const after = Number(url.searchParams.get('after') ?? 0)
        return json({ traffic: agent.traffic.filter((r) => r.id > after).slice(-300) })
      }
      if (url.pathname === '/api/logs') {
        const file = (url.searchParams.get('file') ?? 'edge') as LogFile
        const tail = Math.min(2000, Number(url.searchParams.get('tail') ?? 200))
        return json({ lines: (agent.logs[file] ?? []).slice(-tail) })
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const { a, v } = await readBody(req)
        const f = agent.hw.faults
        switch (a) {
          case 'offline':
            agent.setOffline(!agent.net.offline)
            break
          case 'latency':
            agent.net.latencyMs = Math.max(0, Number(v) || 0)
            break
          case 'badsig':
            agent.net.badSignature = !agent.net.badSignature
            break
          case 'skew':
            agent.net.clockSkewMs = Number(v) || 0
            break
          case 'offset':
            opts.clock.offsetMs = v === 'reset' ? 0 : opts.clock.offsetMs + Number(v) * 3_600_000
            break
          case 'modbus':
            f.modbusDown = !f.modbusDown
            break
          case 'door':
            f.doorControllerDown = !f.doorControllerDown
            break
          case 'stuck': {
            const ch = Number(v)
            const list = new Set(f.stuckChannels ?? [])
            list.has(ch) ? list.delete(ch) : list.add(ch)
            f.stuckChannels = [...list]
            break
          }
          case 'failrate':
            f.writeFailRate = Math.min(1, Math.max(0, Number(v) || 0))
            break
          case 'code':
            return json({ ok: agent.enterCode(String(v ?? '')) })
          case 'motion':
            agent.motion(String(v ?? 'A'))
            break
          case 'heartbeat':
            await agent.heartbeat().catch(() => {})
            break
          case 'status':
            await agent.reportStatus(true).catch(() => {})
            break
          case 'plan':
            agent.planRev = null
            await agent.fetchPlan().catch(() => {})
            break
          case 'flush':
            await agent.flushEvents().catch(() => {})
            break
          case 'restart':
            await agent.stop()
            agent.start()
            break
          case 'clearTraffic':
            agent.traffic.length = 0
            break
          case 'ipRotate':
            if (!agent.floating) return json({ error: '未啟用浮動 IP 模擬' }, 400)
            void agent.rotateIp('手動換 IP（模擬器網頁）', v === undefined ? undefined : Number(v))
            break
          case 'ipEvery':
            if (!agent.floating) return json({ error: '未啟用浮動 IP 模擬' }, 400)
            agent.floating.everyMin = Math.max(0, Number(v) || 0)
            agent.floating.lastRotateAt = Date.now()
            break
          case 'ipReconnect':
            if (agent.floating) agent.floating.reconnectSec = Math.min(120, Math.max(0, Number(v) || 0))
            break
          case 'ipToggle':
            if (agent.floating) agent.floating.enabled = !agent.floating.enabled
            break
          default:
            return json({ error: `未知操作 ${a}` }, 400)
        }
        agent.tick()
        return json({ ok: true })
      }
      const m = url.pathname.match(/^\/media\/([a-z0-9-]+)\/([\w.]+)$/)
      if (m) {
        const data = agent.media?.localFile(m[1], m[2])
        if (!data) return res.writeHead(404).end()
        return res.writeHead(200, { 'content-type': m[2].endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t', 'cache-control': 'no-store' }).end(data)
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        // 每次重讀，改版面不用重開模擬器
        return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(readFileSync(PAGE_FILE))
      }
      res.writeHead(404).end()
    } catch (e) {
      json({ error: (e as Error).message }, 500)
    }
  })
  const host = opts.host ?? '127.0.0.1'
  server.listen(opts.port, host, () => console.log(`場館模擬器網頁：http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${opts.port}${opts.password ? '（需要密碼）' : ''}`))
  return server
}

function nextChange(intervals: { start: string; end: string }[], t: number): string | null {
  let best: number | null = null
  for (const i of intervals) {
    for (const x of [Date.parse(i.start), Date.parse(i.end)]) if (x > t && (best === null || x < best)) best = x
  }
  return best === null ? null : new Date(best).toISOString()
}
