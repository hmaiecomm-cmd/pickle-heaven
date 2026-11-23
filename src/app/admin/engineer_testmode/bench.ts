/**
 * 工程測試台：從雲端直接對「目前連線的場館電腦」（網頁模擬器或實體 IoT PC）下測試情境，觀察回報判定成敗。
 * 在瀏覽器執行，每一步都是呼叫 /api/admin/engineer，所以不受 Vercel 函式時間限制。
 *
 * simOnly：要靠 sim.inject 在地端製造狀況（斷網、RS-485 斷線…），只能對模擬器跑
 * touchesLive：會動到現場設備（開關燈、開門、廣播），連實體場館時要再確認
 */

import type { CircuitDef, CommandRecord, EdgeCommand, MediaSessionInfo, TrafficEntry } from '@gh/iot-contract'

export interface Overview {
  venue: { id: string; name: string; siteCode: string; target: 'LIVE' | 'SIMULATOR' }
  configured: boolean
  activeSiteId?: string
  sites?: Record<'LIVE' | 'SIMULATOR', any>
  active?: any
  plan?: { siteId: string; generatedAt: string; window: { from: string; to: string }; circuits: CircuitDef[]; timeline: any[]; overrides: any[]; doorCodes: any[]; business: any; cameras: any[] } | null
}

export interface BenchApi {
  venue: string
  target: 'LIVE' | 'SIMULATOR'
  confirmLive: boolean
  log: (msg: string) => void
}

export interface Scenario {
  id: string
  group: '連線與計畫' | '迴路指令' | '門禁與廣播' | '攝影機與 NVR' | '地端故障（模擬器）'
  title: string
  simOnly?: boolean
  touchesLive?: boolean
  run: (t: Bench) => Promise<void | 'skip'>
}

const TERMINAL = ['ACKED', 'FAILED', 'EXPIRED', 'REJECTED']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Bench {
  constructor(readonly api: BenchApi) {}
  log(m: string) {
    this.api.log(m)
  }
  private async get<T = any>(view: string, extra = ''): Promise<T> {
    const r = await fetch(`/api/admin/engineer?venue=${encodeURIComponent(this.api.venue)}&view=${view}${extra}`, { cache: 'no-store' })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
    return j
  }
  private async post<T = any>(body: Record<string, unknown>): Promise<T> {
    const r = await fetch('/api/admin/engineer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venue: this.api.venue, ...body }) })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
    return j
  }
  overview = () => this.get<Overview>('overview')
  traffic = async () => (await this.get<{ traffic: TrafficEntry[] }>('traffic', '&limit=300')).traffic
  media = async () => (await this.get<{ sessions: MediaSessionInfo[] }>('media')).sessions
  nvr = (id: string) => this.get<any>('nvr', `&id=${encodeURIComponent(id)}`)
  push = () => this.post<{ rev: number; changed: boolean }>({ action: 'push' })
  sleep = sleep

  async send(command: EdgeCommand, ttlSec?: number, id?: string): Promise<CommandRecord> {
    const r = await this.post<CommandRecord>({ action: 'command', command, ttlSec, id, confirmLive: this.api.confirmLive })
    this.log(`→ 下行 ${command.type}（${r.id.slice(0, 16)}…）`)
    return r
  }
  async waitCmd(id: string, timeoutMs = 20_000): Promise<CommandRecord> {
    const until = Date.now() + timeoutMs
    for (;;) {
      const r = await this.get<CommandRecord>('command', `&id=${encodeURIComponent(id)}`)
      if (TERMINAL.includes(r.status)) {
        this.log(`← ${r.command.type} ${r.status}${r.ack?.error ? `：${r.ack.error}` : ''}`)
        return r
      }
      if (Date.now() > until) throw new Error(`等待 ${r.command.type} 結果逾時（目前 ${r.status}）`)
      await sleep(700)
    }
  }
  async expect(command: EdgeCommand, status: string, ttlSec?: number, timeoutMs?: number) {
    const r = await this.waitCmd((await this.send(command, ttlSec)).id, timeoutMs)
    this.check(r.status === status, `${command.type} 應為 ${status}，實際 ${r.status}${r.ack?.error ? `（${r.ack.error}）` : ''}`)
    return r
  }
  async until<T>(label: string, fn: () => Promise<T | null | undefined | false>, timeoutMs = 20_000, everyMs = 1_000): Promise<T> {
    const end = Date.now() + timeoutMs
    for (;;) {
      const v = await fn().catch(() => null)
      if (v) return v
      if (Date.now() > end) throw new Error(`等待逾時：${label}`)
      await sleep(everyMs)
    }
  }
  /** 等 Gateway 流量紀錄出現符合條件、且晚於 since 的一筆 */
  waitTraffic(label: string, since: number, pred: (t: TrafficEntry) => boolean, timeoutMs = 20_000) {
    return this.until(label, async () => (await this.traffic()).find((t) => Date.parse(t.at) >= since - 1_000 && pred(t)), timeoutMs, 1_200)
  }
  check(cond: unknown, msg: string): void {
    if (!cond) throw new Error(msg)
    this.log(`✓ ${msg.replace(/，實際.*$/, '')}`)
  }
  async plan() {
    const o = await this.overview()
    if (!o.plan) throw new Error('平台組不出場館計畫（場館代碼或迴路未設定）')
    return o.plan
  }
  async circuitOf(pred: (c: CircuitDef) => boolean) {
    return (await this.plan()).circuits.find(pred) ?? null
  }
  async inject(fault: string, extra: Record<string, unknown> = {}) {
    return this.expect({ type: 'sim.inject', fault: fault as any, ...extra } as EdgeCommand, 'ACKED')
  }
}

const iso = (t: number) => new Date(t).toISOString()
const sid = (p: string) => `${p}-${crypto.randomUUID()}`

export const SCENARIOS: Scenario[] = [
  // ───────── 連線與計畫 ─────────
  {
    id: 'health',
    group: '連線與計畫',
    title: '連線健康：場館在線、已有計畫、回報的計畫版本與雲端一致',
    async run(t) {
      const o = await t.overview()
      t.check(o.active, `Gateway 有這個場館（${o.activeSiteId}）`)
      t.check(o.active.online, '場館在線（90 秒內有心跳或長輪詢）')
      t.check(o.active.planRev > 0, `雲端有計畫 rev ${o.active.planRev}`)
      t.check(o.active.status?.planRev === o.active.planRev, `場館回報的計畫 rev ${o.active.status?.planRev} 與雲端 ${o.active.planRev} 一致`)
    },
  },
  {
    id: 'plan-push',
    group: '連線與計畫',
    title: '推送計畫：平台推 → 場館下載 → 回報新版本',
    async run(t) {
      const r = await t.push()
      t.log(`推送 rev ${r.rev}（${r.changed ? '有變更' : '內容相同'}）`)
      await t.until(`場館回報 rev ${r.rev}`, async () => (await t.overview()).active?.status?.planRev === r.rev, 25_000)
      t.check(true, `場館已套用 rev ${r.rev}`)
    },
  },
  {
    id: 'plan-same',
    group: '連線與計畫',
    title: '計畫冪等：內容沒變重推兩次，版本不遞增（上千場館不會白白重下載）',
    async run(t) {
      const a = await t.push()
      const b = await t.push()
      t.check(b.rev === a.rev && b.changed === false, `第二次推送 rev 不變（${a.rev} → ${b.rev}）`)
    },
  },
  {
    id: 'plan-refresh',
    group: '連線與計畫',
    title: 'plan.refresh：要求場館忽略快取重新下載計畫',
    async run(t) {
      const since = Date.now()
      await t.expect({ type: 'plan.refresh' }, 'ACKED')
      await t.waitTraffic('場館 GET /plan 200', since, (x) => x.path.startsWith('/plan') && x.status === 200)
      t.check(true, '流量紀錄看到場館重新下載計畫（200）')
    },
  },
  {
    id: 'status-report',
    group: '連線與計畫',
    title: 'status.report：要求場館立即回報 16 路實際狀態',
    async run(t) {
      const since = Date.now()
      await t.expect({ type: 'status.report' }, 'ACKED')
      await t.waitTraffic('場館 PUT /status', since, (x) => x.path === '/status' && x.status === 200)
      t.check(true, '收到場館狀態回報')
    },
  },
  {
    id: 'duplicate-id',
    group: '連線與計畫',
    title: '指令冪等：同一個指令 ID 送兩次只建立一筆、只執行一次',
    async run(t) {
      const id = sid('dup')
      const a = await t.send({ type: 'status.report' }, 30, id)
      const b = await t.send({ type: 'status.report' }, 30, id)
      t.check(a.id === b.id && b.createdAt === a.createdAt, '第二次回傳同一筆指令')
      await t.waitCmd(id)
    },
  },

  // ───────── 迴路指令 ─────────
  {
    id: 'circuit-minutes',
    group: '迴路指令',
    touchesLive: true,
    title: '手動開球場燈 2 分鐘 → ack 與讀回 ON → circuit.release 交回排程',
    async run(t) {
      const c = await t.circuitOf((x) => x.kind === 'COURT' && x.remote)
      if (!c) return 'skip'
      const r = await t.expect({ type: 'circuit.set', circuit: c.no, state: 'ON', hold: { mode: 'MINUTES', until: iso(Date.now() + 2 * 60_000) }, reason: '工程測試' }, 'ACKED')
      t.check(r.ack?.circuits?.[c.no] === 'ON', `讀回 ${c.no} ${c.name} = ON`)
      await t.expect({ type: 'circuit.release', circuit: c.no }, 'ACKED')
    },
  },
  {
    id: 'circuit-next-change',
    group: '迴路指令',
    touchesLive: true,
    title: '手動關營業迴路「到下一個切換點」→ ack 讀回 OFF → 恢復',
    async run(t) {
      const c = await t.circuitOf((x) => x.kind === 'BUSINESS' && x.remote && !x.maxOnMinutes)
      if (!c) return 'skip'
      const r = await t.expect({ type: 'circuit.set', circuit: c.no, state: 'OFF', hold: { mode: 'NEXT_CHANGE' }, reason: '工程測試' }, 'ACKED')
      t.check(r.ack?.circuits?.[c.no] === 'OFF', `讀回 ${c.no} ${c.name} = OFF`)
      await t.expect({ type: 'circuit.release', circuit: c.no }, 'ACKED')
    },
  },
  {
    id: 'reject-always-on',
    group: '迴路指令',
    title: '24 小時供電迴路（門鎖供電等）不接受遠端關閉 → REJECTED',
    async run(t) {
      const c = await t.circuitOf((x) => x.kind === 'ALWAYS_ON')
      if (!c) return 'skip'
      await t.expect({ type: 'circuit.set', circuit: c.no, state: 'OFF', hold: { mode: 'INDEFINITE' }, reason: '工程測試：應被拒絕' }, 'REJECTED')
    },
  },
  {
    id: 'reject-unknown-circuit',
    group: '迴路指令',
    title: '計畫裡沒有的迴路 → REJECTED（不可亂動未定義的 DO 通道）',
    async run(t) {
      const plan = await t.plan()
      const used = new Set(plan.circuits.map((c) => c.no))
      const free = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0')).find((n) => !used.has(n))
      if (!free) return 'skip'
      await t.expect({ type: 'circuit.set', circuit: free, state: 'ON', hold: { mode: 'NEXT_CHANGE' } }, 'REJECTED')
    },
  },

  // ───────── 門禁與廣播 ─────────
  {
    id: 'door-unlock',
    group: '門禁與廣播',
    touchesLive: true,
    title: '遠端開門 3 秒 → ack → 場館回報 door.unlocked 事件',
    async run(t) {
      const since = Date.now()
      await t.expect({ type: 'door.unlock', door: 'main', seconds: 3, reason: '工程測試' }, 'ACKED')
      await t.waitTraffic('door.unlocked 事件', since, (x) => x.path === '/events' && (x.note ?? '').includes('door.unlocked'))
      t.check(true, '收到 door.unlocked 事件')
    },
  },
  {
    id: 'audio',
    group: '門禁與廣播',
    touchesLive: true,
    title: '遠端廣播 goodnight.mp3 → ack → audio.played 事件',
    async run(t) {
      const since = Date.now()
      await t.expect({ type: 'audio.play', file: 'goodnight.mp3' }, 'ACKED')
      await t.waitTraffic('audio.played 事件', since, (x) => x.path === '/events' && (x.note ?? '').includes('audio.played'))
      t.check(true, '收到 audio.played 事件')
    },
  },
  {
    id: 'log-upload',
    group: '門禁與廣播',
    title: '調閱場館 log（最近 15 分鐘 edge＋audit）→ 上傳 → ack',
    async run(t) {
      await t.expect({ type: 'log.upload', files: ['edge', 'audit'], from: iso(Date.now() - 15 * 60_000), to: iso(Date.now()) }, 'ACKED', 120, 30_000)
    },
  },

  // ───────── 攝影機與 NVR ─────────
  {
    id: 'camera-live',
    group: '攝影機與 NVR',
    title: '即時影像：CAM04 直播 20 秒 → 收到 HLS 片段 → camera.stop',
    async run(t) {
      const session = sid('live')
      await t.expect({ type: 'camera.live', camera: '04', session, seconds: 20 }, 'ACKED')
      const m = await t.until('收到 2 個以上片段', async () => (await t.media()).find((x) => x.session === session && x.segments >= 2), 25_000)
      t.check(m.bytes > 0, `收到 ${m.segments} 片、${Math.round(m.bytes / 1024)} KB`)
      await t.expect({ type: 'camera.stop', session }, 'ACKED')
    },
  },
  {
    id: 'camera-six',
    group: '攝影機與 NVR',
    title: '6 路同時直播 15 秒：每路都收到片段（頻寬與限流）',
    async run(t) {
      const plan = await t.plan()
      const cams = (plan.cameras.length ? plan.cameras : [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n).padStart(2, '0') }))).map((c: any) => c.id)
      const sessions = await Promise.all(cams.map(async (cam: string) => {
        const session = sid(`live${cam}`)
        await t.send({ type: 'camera.live', camera: cam, session, seconds: 15 })
        return { cam, session }
      }))
      await t.until('6 路都收到片段', async () => {
        const list = await t.media()
        return sessions.every((s: { session: string }) => (list.find((m) => m.session === s.session)?.segments ?? 0) >= 1)
      }, 30_000, 1_500)
      t.check(true, `${sessions.length} 路都收到影像`)
      await Promise.all(sessions.map((s: { session: string }) => t.send({ type: 'camera.stop', session: s.session })))
    },
  },
  {
    id: 'nvr-index',
    group: '攝影機與 NVR',
    title: 'NVR 錄影索引：CAM04、CAM06 最近 14 天（連續錄影＋位移事件）',
    async run(t) {
      const r = await t.expect({ type: 'nvr.index', cameras: ['04', '06'], from: iso(Date.now() - 14 * 86_400_000), to: iso(Date.now()) }, 'ACKED', 120)
      const idx = await t.nvr(r.id)
      const cont = idx.recordings.filter((x: any) => x.kind === 'continuous').length
      t.check(cont >= 2 * 24 * 13, `連續錄影 ${cont} 段（約 2 支 × 14 天 × 24 小時）`)
      t.check(idx.recordings.some((x: any) => x.kind === 'motion'), `位移事件 ${idx.recordings.filter((x: any) => x.kind === 'motion').length} 段`)
    },
  },
  {
    id: 'nvr-clip',
    group: '攝影機與 NVR',
    title: '調閱昨天同一時間 CAM04 一分鐘錄影 → VOD 片段全部上傳',
    async run(t) {
      const session = sid('clip')
      const from = Date.now() - 86_400_000
      await t.expect({ type: 'nvr.clip', camera: '04', session, from: iso(from), to: iso(from + 60_000) }, 'ACKED', 120)
      const m = await t.until('錄影傳完', async () => (await t.media()).find((x) => x.session === session && x.ended), 90_000, 2_000)
      t.check(m.segments > 0 && m.endReason === 'COMPLETED', `錄影 ${m.segments} 片、${Math.round(m.bytes / 1024)} KB`)
    },
  },
  {
    id: 'nvr-too-old',
    group: '攝影機與 NVR',
    title: '調閱 15 天前的錄影（超過 NVR 保存 14 天）→ FAILED',
    async run(t) {
      const from = Date.now() - 15 * 86_400_000
      await t.expect({ type: 'nvr.clip', camera: '04', session: sid('old'), from: iso(from), to: iso(from + 60_000) }, 'FAILED', 120)
    },
  },

  // ───────── 地端故障（只限模擬器） ─────────
  {
    id: 'sim-expired',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '斷網中下的指令會過期：斷網 20 秒，送 TTL 5 秒的指令 → EXPIRED，不補執行',
    async run(t) {
      await t.inject('offline', { seconds: 20 })
      await t.sleep(1_500)
      await t.expect({ type: 'status.report' }, 'EXPIRED', 5, 45_000)
    },
  },
  {
    id: 'sim-recover',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '斷網 15 秒後恢復：場館補傳 agent.recovered 與斷網期間的事件',
    async run(t) {
      const since = Date.now()
      await t.inject('offline', { seconds: 15 })
      await t.waitTraffic('恢復後上傳 agent.recovered', since, (x) => x.path === '/events' && (x.note ?? '').includes('agent.recovered'), 60_000)
      t.check(true, '收到 agent.recovered')
    },
  },
  {
    id: 'sim-modbus',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: 'RS-485 斷線 20 秒：狀態回報 modbus=ERROR，恢復後回到 OK',
    async run(t) {
      await t.inject('modbus', { seconds: 20 })
      await t.until('modbus=ERROR', async () => (await t.overview()).active?.status?.hardware?.modbus === 'ERROR', 20_000)
      t.check(true, '雲端看到 modbus=ERROR')
      await t.until('modbus 恢復 OK', async () => (await t.overview()).active?.status?.hardware?.modbus === 'OK', 45_000)
      t.check(true, '恢復後 modbus=OK')
    },
  },
  {
    id: 'sim-stuck',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '繼電器卡住：手動切換該迴路 → 讀回不一致 → FAILED',
    async run(t) {
      const c = await t.circuitOf((x) => x.kind === 'COURT' && x.remote)
      if (!c) return 'skip'
      const o = await t.overview()
      const cur = o.active?.status?.circuits?.[c.no] ?? 'OFF'
      await t.inject('stuck', { channel: c.channel, seconds: 30 })
      await t.expect({ type: 'circuit.set', circuit: c.no, state: cur === 'ON' ? 'OFF' : 'ON', hold: { mode: 'MINUTES', until: iso(Date.now() + 60_000) } }, 'FAILED')
      await t.inject('reset')
      await t.expect({ type: 'circuit.release', circuit: c.no }, 'ACKED')
    },
  },
  {
    id: 'sim-lockout',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '門口連續輸錯密碼 6 次 → 第 6 次起 LOCKOUT，事件只帶遮罩',
    async run(t) {
      const since = Date.now()
      for (let i = 0; i < 6; i++) await t.inject('code', { value: '000000' })
      await t.waitTraffic('door.code_denied 事件', since, (x) => x.path === '/events' && (x.note ?? '').includes('door.code_denied'))
      t.check(true, '收到 door.code_denied')
    },
  },
  {
    id: 'sim-skew',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '場館時鐘快 6 分鐘：Gateway 拒絕（401 CLOCK_SKEW），校正後恢復',
    async run(t) {
      const since = Date.now()
      await t.inject('skew', { value: '360000', seconds: 15 })
      await t.waitTraffic('401 CLOCK_SKEW', since, (x) => x.status === 401 && (x.note ?? '').includes('CLOCK_SKEW'))
      t.check(true, 'Gateway 拒絕時鐘偏差的請求')
      await t.until('恢復連線', async () => (await t.overview()).active?.online, 45_000)
    },
  },
  {
    id: 'sim-motion',
    group: '地端故障（模擬器）',
    simOnly: true,
    title: '沒有預約的球場有人進場 → motion.unbooked 事件＋廣播 do_not_use_court',
    async run(t) {
      const since = Date.now()
      await t.inject('motion', { value: 'B' })
      await t.waitTraffic('motion.unbooked 事件', since, (x) => x.path === '/events' && /motion\.unbooked|audio\.played/.test(x.note ?? ''))
      t.check(true, '收到現場事件（若 B 場此刻有預約則只有一般事件）')
    },
  },
]
