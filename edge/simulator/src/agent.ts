import { randomUUID } from 'node:crypto'
import {
  LOG_FILES,
  LOG_LEVELS,
  LOG_UPLOAD_MAX_BYTES,
  bookedCourts,
  checkDoorCode,
  desiredState,
  scheduledState,
  type CircuitDef,
  type CircuitOverride,
  type CommandAck,
  type CommandEnvelope,
  type CommandsResponse,
  type EdgeEvent,
  type EdgeEventType,
  type HeartbeatResponse,
  type LogFile,
  type LogLevel,
  type LogUploadFile,
  type OnOff,
  type SitePlan,
  type StatusReport,
} from '../../../packages/iot-contract/src/index'
import { FakeHardware } from './hardware'
import { HttpStatusError, NetworkDownError, signedFetch } from './http'

/**
 * 場館電腦參考實作（模擬器的核心，地端廠商可照這個流程實作）。
 *
 * 執行緒（皆為主動連出）：
 *   心跳          每 heartbeatMs  POST /edge/v1/heartbeat
 *   指令長輪詢    持續            GET  /edge/v1/commands?wait=25 → 執行 → POST /commands/:id/ack
 *   計畫          planRev 變動時  GET  /edge/v1/plan（ETag）
 *   事件上傳      每 flushMs      POST /edge/v1/events（本機佇列，斷網累積、恢復後補送）
 *   狀態回報      DO 狀態變動時   PUT  /edge/v1/status
 *   本機排程      每 tickMs       依計畫＋手動操作計算 16 路該有的狀態並寫入 DO
 *   log 調閱      收到 log.upload 篩選本機 log → PUT /edge/v1/logs/:id → ack
 *
 * 斷網時本機排程、門禁照常運作，只是不能接收新指令與新計畫。
 */

export interface Clock {
  now(): number
}

export interface AgentOptions {
  baseUrl: string
  siteId: string
  secret: string
  clock?: Clock
  hardware?: FakeHardware
  agentVersion?: string
  heartbeatMs?: number
  flushMs?: number
  tickMs?: number
  pollWaitSec?: number
  log?: (msg: string) => void
}

export interface NetworkFaults {
  /** 斷網：所有請求立即失敗 */
  offline?: boolean
  /** 每個請求額外延遲 */
  latencyMs?: number
  /** 故意簽錯章 */
  badSignature?: boolean
  /** 本機時鐘偏移（簽章時間戳） */
  clockSkewMs?: number
}

type LocalOverride = CircuitOverride & { createdAt: number }

/** 本機 log（JSON Lines，對應規格 11.1 的 edge.log／audit.log／modbus.log）；模擬器放記憶體 */
const LOG_KEEP_LINES = 20_000

export class EdgeAgent {
  readonly opts: Required<Omit<AgentOptions, 'log'>> & { log: (m: string) => void }
  readonly hw: FakeHardware
  plan: SitePlan | null = null
  planRev: number | null = null
  readonly overrides = new Map<string, LocalOverride>()
  readonly outbox: EdgeEvent[] = []
  readonly logs: Record<LogFile, string[]> = { edge: [], audit: [], modbus: [] }
  readonly executed: { id: string; command: CommandEnvelope['command']; result: CommandAck['result']; at: number }[] = []
  net: NetworkFaults = {}
  lastError: string | null = null
  online = false
  serverPlanRev = 0
  private started = 0
  private running = false
  private loops: Promise<void>[] = []
  private abort = new AbortController()
  private onTimers = new Map<number, number>() // channel → 連續開啟起點
  private lastPublished = ''
  private codeFailures: number[] = []
  private prevCourts = new Set<string>()
  private everOffline = false

  constructor(o: AgentOptions) {
    this.opts = {
      clock: { now: () => Date.now() },
      hardware: new FakeHardware(),
      agentVersion: 'sim-1.0.0',
      heartbeatMs: 30_000,
      flushMs: 2_000,
      tickMs: 1_000,
      pollWaitSec: 25,
      ...o,
      log: o.log ?? (() => {}),
    }
    this.hw = this.opts.hardware
  }

  now() {
    return this.opts.clock.now()
  }
  private iso(t = this.now()) {
    return new Date(t).toISOString()
  }

  // ───────────── 網路 ─────────────

  private async call(method: string, path: string, body?: unknown, headers?: Record<string, string>, signal?: AbortSignal) {
    if (this.net.offline) throw new NetworkDownError('offline')
    if (this.net.latencyMs) await new Promise((r) => setTimeout(r, this.net.latencyMs))
    if (this.net.offline) throw new NetworkDownError('offline')
    const t0 = Date.now()
    try {
      const r = await signedFetch({
        baseUrl: this.opts.baseUrl,
        keyId: this.opts.siteId,
        secret: this.opts.secret,
        method,
        path,
        body,
        headers,
        tamper: { badSignature: this.net.badSignature, skewMs: this.net.clockSkewMs },
        signal,
      })
      if (!path.startsWith('/edge/v1/commands?')) this.writeLog('edge', 'DEBUG', 'http', 'request', { method, path: path.split('?')[0], status: r.status, durationMs: Date.now() - t0 })
      return r
    } catch (e) {
      this.lastError = (e as Error).message
      const status = e instanceof HttpStatusError ? e.status : undefined
      const code = e instanceof HttpStatusError ? e.code : (e as Error).name
      if ((e as Error).name !== 'AbortError') this.writeLog('edge', 'WARN', 'http', 'request failed', { method, path: path.split('?')[0], status, code, durationMs: Date.now() - t0 })
      throw e
    }
  }

  /** 寫一行本機 log（禁止寫入金鑰、簽章、門禁明碼） */
  writeLog(file: LogFile, level: LogLevel, component: string, msg: string, extra: Record<string, unknown> = {}) {
    const line = JSON.stringify({ ts: this.iso(), level, siteId: this.opts.siteId, component, msg, planRev: this.planRev, ...extra })
    const buf = this.logs[file]
    buf.push(line)
    if (buf.length > LOG_KEEP_LINES) buf.splice(0, buf.length - LOG_KEEP_LINES)
  }

  async heartbeat(): Promise<HeartbeatResponse> {
    const r = await this.call('POST', '/edge/v1/heartbeat', {
      agentVersion: this.opts.agentVersion,
      localTime: new Date(Date.now() + (this.net.clockSkewMs ?? 0)).toISOString(),
      uptimeSec: Math.round((Date.now() - this.started) / 1000),
      planRev: this.planRev,
      pendingEvents: this.outbox.length,
    })
    const res = r.json as HeartbeatResponse
    if (!this.online && this.everOffline) this.emit('agent.recovered', { pendingEvents: this.outbox.length })
    this.online = true
    this.serverPlanRev = res.planRev
    if (res.planRev !== this.planRev) await this.fetchPlan()
    return res
  }

  async fetchPlan(): Promise<boolean> {
    const r = await this.call('GET', '/edge/v1/plan', undefined, this.planRev !== null ? { 'if-none-match': `"${this.planRev}"` } : undefined).catch((e) => {
      if (e instanceof HttpStatusError && e.code === 'NO_PLAN') return null
      throw e
    })
    if (!r || r.status === 304) return false
    this.loadPlan(r.json as SitePlan)
    return true
  }

  /** 載入新計畫：計畫裡的手動操作為準，但保留計畫產生之後才在本機收到的手動操作 */
  loadPlan(plan: SitePlan) {
    const generated = Date.parse(plan.generatedAt)
    const keep = [...this.overrides.values()].filter((o) => o.createdAt > generated)
    this.overrides.clear()
    for (const o of plan.overrides) this.overrides.set(o.circuit, { ...o, createdAt: generated })
    for (const o of keep) this.overrides.set(o.circuit, o)
    this.plan = plan
    this.planRev = plan.rev ?? null
    this.opts.log(`plan rev ${plan.rev} loaded: ${plan.timeline.length} intervals, ${plan.doorCodes.length} codes`)
    this.writeLog('edge', 'INFO', 'plan', 'plan loaded', { rev: plan.rev, intervals: plan.timeline.length, codes: plan.doorCodes.length })
    this.tick()
  }

  async pollCommands(waitSec = this.opts.pollWaitSec): Promise<number> {
    const r = await this.call('GET', `/edge/v1/commands?wait=${waitSec}`, undefined, undefined, this.abort.signal)
    const res = r.json as CommandsResponse
    this.online = true
    this.serverPlanRev = res.planRev
    if (res.planRev !== this.planRev) await this.fetchPlan()
    for (const env of res.commands) await this.execute(env)
    return res.commands.length
  }

  async flushEvents(): Promise<number> {
    if (this.outbox.length === 0) return 0
    const batch = this.outbox.slice(0, 200)
    const r = await this.call('POST', '/edge/v1/events', { events: batch })
    const acked = new Set<string>(r.json.acked)
    for (let i = this.outbox.length - 1; i >= 0; i--) if (acked.has(this.outbox[i].eventId)) this.outbox.splice(i, 1)
    return acked.size
  }

  async reportStatus(force = false) {
    const status = this.status()
    const key = JSON.stringify(status.circuits) + status.planRev
    if (!force && key === this.lastPublished) return
    await this.call('PUT', '/edge/v1/status', status)
    this.lastPublished = key
  }

  status(): StatusReport {
    const circuits: Record<string, OnOff> = {}
    for (const d of this.plan?.circuits ?? []) circuits[d.no] = this.hw.readRelay(d.channel) ?? 'OFF'
    return {
      at: this.iso(),
      planRev: this.planRev,
      circuits,
      door: { locked: this.hw.doorLocked },
      hardware: { modbus: this.hw.faults.modbusDown ? 'ERROR' : 'OK', doorController: this.hw.faults.doorControllerDown ? 'ERROR' : 'OK', speaker: 'OK' },
    }
  }

  // ───────────── 指令執行 ─────────────

  async execute(env: CommandEnvelope) {
    if (this.executed.some((e) => e.id === env.id)) {
      // 重送：不重複執行，只補 ack
      const prev = this.executed.find((e) => e.id === env.id)!
      await this.ack(env.id, { result: prev.result, at: this.iso() })
      return
    }
    const at = this.now()
    let ack: CommandAck
    if (Date.parse(env.expiresAt) <= Date.now()) {
      ack = { result: 'EXPIRED', at: this.iso(at), error: '指令已過期，未執行' }
    } else if (env.command.type === 'log.upload') {
      ack = await this.uploadLogs(env.id, env.command, at)
    } else {
      ack = this.apply(env.command, at)
    }
    this.writeLog('edge', ack.result === 'OK' ? 'INFO' : 'WARN', 'command', `${env.command.type} executed`, { commandId: env.id, result: ack.result, error: ack.error })
    this.writeLog('audit', 'INFO', 'command', env.command.type, { commandId: env.id, requestedBy: env.requestedBy, result: ack.result })
    this.executed.push({ id: env.id, command: env.command, result: ack.result, at })
    if (this.executed.length > 500) this.executed.splice(0, 100)
    await this.ack(env.id, ack)
  }

  private def(no: string): CircuitDef | undefined {
    return this.plan?.circuits.find((c) => c.no === no)
  }

  private apply(cmd: CommandEnvelope['command'], at: number): CommandAck {
    const done = (extra: Partial<CommandAck> = {}): CommandAck => ({ result: 'OK', at: this.iso(at), circuits: this.status().circuits, ...extra })
    switch (cmd.type) {
      case 'circuit.set': {
        const d = this.def(cmd.circuit)
        if (!d) return { result: 'REJECTED', at: this.iso(at), error: `沒有迴路 ${cmd.circuit}` }
        if (!d.remote || d.kind === 'ALWAYS_ON' || d.kind === 'RESERVED') return { result: 'REJECTED', at: this.iso(at), error: `迴路 ${cmd.circuit} 不允許遠端控制` }
        const baseline = scheduledState(this.plan!, d.no, at)
        this.overrides.set(d.no, { circuit: d.no, state: cmd.state, hold: cmd.hold, baseline: cmd.hold.mode === 'NEXT_CHANGE' ? baseline : undefined, createdAt: at })
        const ok = this.drive(d, cmd.state, 'OVERRIDE', at)
        if (!ok) {
          this.emit('hardware.error', { circuit: d.no, channel: d.channel, message: '繼電器寫入失敗或讀回不一致' })
          return { result: 'FAILED', at: this.iso(at), error: `DO${String(d.channel).padStart(2, '0')} 寫入失敗`, circuits: this.status().circuits }
        }
        return done()
      }
      case 'circuit.release': {
        this.overrides.delete(cmd.circuit)
        this.tick()
        return done()
      }
      case 'door.unlock': {
        if (!this.hw.unlock(cmd.door, cmd.seconds, at)) return { result: 'FAILED', at: this.iso(at), error: '門禁控制器無回應' }
        this.emit('door.unlocked', { door: cmd.door, by: 'remote', seconds: cmd.seconds })
        return done()
      }
      case 'status.report':
        void this.reportStatus(true).catch(() => {})
        return done()
      case 'plan.refresh':
        this.planRev = null
        void this.fetchPlan().catch(() => {})
        return done()
      case 'audio.play':
        this.hw.play(cmd.file, at)
        this.emit('audio.played', { file: cmd.file, by: 'remote' })
        return done()
      case 'log.upload':
        return { result: 'REJECTED', at: this.iso(at), error: 'log.upload 由 uploadLogs 處理' }
    }
  }

  /** log.upload：依時間與等級篩選，超過上限時保留最新的部分，上傳成功才回 OK */
  async uploadLogs(id: string, cmd: Extract<CommandEnvelope['command'], { type: 'log.upload' }>, at: number): Promise<CommandAck> {
    const from = Date.parse(cmd.from)
    const to = Date.parse(cmd.to)
    const minRank = LOG_LEVELS.indexOf(cmd.minLevel ?? 'DEBUG')
    let budget = Math.min(cmd.maxBytes ?? LOG_UPLOAD_MAX_BYTES, LOG_UPLOAD_MAX_BYTES)
    const files: LogUploadFile[] = []
    for (const name of LOG_FILES.filter((f) => cmd.files.includes(f))) {
      const picked = this.logs[name].filter((line) => {
        const r = JSON.parse(line) as { ts: string; level: LogLevel }
        const t = Date.parse(r.ts)
        return t >= from && t <= to && LOG_LEVELS.indexOf(r.level) >= minRank
      })
      // 從最新往回收，直到用完預算
      const kept: string[] = []
      let bytes = 0
      for (let i = picked.length - 1; i >= 0; i--) {
        const b = Buffer.byteLength(picked[i]) + 1
        if (bytes + b > budget) break
        kept.unshift(picked[i])
        bytes += b
      }
      budget -= bytes
      files.push({ name, content: kept.length ? kept.join('\n') + '\n' : '', lines: kept.length, truncated: kept.length < picked.length })
    }
    try {
      await this.call('PUT', `/edge/v1/logs/${encodeURIComponent(id)}`, { from: cmd.from, to: cmd.to, files })
      return { result: 'OK', at: this.iso(at) }
    } catch (e) {
      return { result: 'FAILED', at: this.iso(at), error: `log 上傳失敗：${(e as Error).message}` }
    }
  }

  private async ack(id: string, ack: CommandAck) {
    try {
      await this.call('POST', `/edge/v1/commands/${encodeURIComponent(id)}/ack`, ack)
    } catch {
      // ack 失敗：Gateway 會在 REDELIVER_AFTER_SEC 後重送，屆時用 executed 補 ack
    }
  }

  // ───────────── 本機排程（斷網也照跑） ─────────────

  /** 寫入一路並讀回確認；回傳是否成功 */
  private drive(d: CircuitDef, state: OnOff, source: string, at: number): boolean {
    const before = this.hw.readRelay(d.channel)
    const wrote = this.hw.writeRelay(d.channel, state)
    const after = this.hw.readRelay(d.channel)
    this.writeLog('modbus', wrote && after === state ? 'DEBUG' : 'ERROR', 'modbus', 'write coil', { fn: 5, channel: d.channel, value: state, readBack: after ?? null, ok: wrote && after === state })
    if (!wrote || after !== state) return false
    if (before !== after) {
      this.emit('circuit.changed', { circuit: d.no, channel: d.channel, state, source })
      this.writeLog('audit', 'INFO', 'schedule', 'circuit changed', { circuit: d.no, before: before ?? null, after: state, source })
      if (state === 'ON') this.onTimers.set(d.channel, at)
      else this.onTimers.delete(d.channel)
    }
    return true
  }

  /** 依計畫計算每一路該有的狀態並寫入；也處理安全上限與廣播 */
  tick() {
    const plan = this.plan
    if (!plan) return
    const at = this.now()
    for (const d of plan.circuits) {
      const o = this.overrides.get(d.no)
      const want = desiredState(d, plan, o, at)
      if (want.expiredOverride) this.overrides.delete(d.no)
      // 安全上限：連續開啟過久強制關閉（並取消手動維持）
      const since = this.onTimers.get(d.channel)
      if (d.maxOnMinutes && since !== undefined && want.state === 'ON' && at - since >= d.maxOnMinutes * 60_000) {
        this.overrides.set(d.no, { circuit: d.no, state: 'OFF', hold: { mode: 'NEXT_CHANGE' }, baseline: scheduledState(plan, d.no, at), createdAt: at })
        if (this.drive(d, 'OFF', 'SAFETY', at)) this.emit('circuit.forced_off', { circuit: d.no, onMinutes: Math.round((at - since) / 60_000), limit: d.maxOnMinutes })
        continue
      }
      if (this.hw.readRelay(d.channel) !== want.state) {
        if (!this.drive(d, want.state, want.source, at)) this.emit('hardware.error', { circuit: d.no, channel: d.channel, message: '排程寫入失敗' })
      }
    }
    // 廣播：球場開始／結束使用
    const courts = new Set(bookedCourts(plan, at))
    for (const c of courts) if (!this.prevCourts.has(c)) this.cue('opening', { court: c })
    for (const c of this.prevCourts) if (!courts.has(c)) this.cue('ending', { court: c })
    this.prevCourts = courts
  }

  private cue(name: 'welcome' | 'opening' | 'ending' | 'goodnight' | 'doNotUseCourt', data: Record<string, unknown>) {
    const file = this.plan?.audio?.[name] ?? `${name}.mp3`
    this.hw.play(file, this.now())
    this.emit('audio.played', { file, cue: name, ...data })
  }

  // ───────────── 現場事件 ─────────────

  /** 有人在門口輸入密碼 */
  enterCode(input: string, door = 'main'): boolean {
    const at = this.now()
    this.codeFailures = this.codeFailures.filter((t) => at - t < 5 * 60_000)
    if (this.codeFailures.length >= 5) {
      this.emit('door.code_denied', { door, reason: 'LOCKOUT', attempts: this.codeFailures.length })
      return false
    }
    const hit = this.plan ? checkDoorCode(this.plan, input, at, door) : null
    if (!hit) {
      this.codeFailures.push(at)
      this.emit('door.code_denied', { door, reason: this.plan ? 'INVALID_OR_OUT_OF_WINDOW' : 'NO_PLAN', masked: `****${input.slice(-2)}` })
      return false
    }
    if (!this.hw.unlock(door, 5, at)) {
      this.emit('hardware.error', { door, message: '門禁控制器無回應' })
      return false
    }
    this.emit('door.code_ok', { door, codeId: hit.id, slotType: hit.slotType })
    this.cue('welcome', { door })
    return true
  }

  /** 攝影機偵測到球場有人移動 */
  motion(court: string) {
    if (!this.plan) return
    const booked = bookedCourts(this.plan, this.now())
    if (booked.includes(court)) return
    this.emit('motion.unbooked', { court })
    this.cue('doNotUseCourt', { court })
  }

  emit(type: EdgeEventType, data?: Record<string, unknown>) {
    const eventId = randomUUID()
    this.outbox.push({ eventId, type, at: this.iso(), data })
    const level: LogLevel = type === 'hardware.error' ? 'ERROR' : type === 'door.code_denied' || type === 'circuit.forced_off' ? 'WARN' : 'INFO'
    this.writeLog(type.startsWith('door.') ? 'audit' : 'edge', level, type.split('.')[0], type, { eventId, ...data })
    if (this.outbox.length > 10_000) this.outbox.splice(0, this.outbox.length - 10_000)
  }

  /** 模擬斷網／恢復（會中斷進行中的長輪詢） */
  setOffline(offline: boolean) {
    this.net.offline = offline
    if (offline) {
      this.abort.abort()
      this.abort = new AbortController()
      if (this.online) this.everOffline = true
      this.online = false
    }
  }

  // ───────────── 生命週期 ─────────────

  start() {
    if (this.running) return
    this.running = true
    this.started = Date.now()
    this.abort = new AbortController()
    this.emit('agent.started', { agentVersion: this.opts.agentVersion })
    const forever = (fn: () => Promise<unknown>, gapMs: number, errGapMs = 2_000) =>
      (async () => {
        while (this.running) {
          let gap = gapMs
          try {
            await fn()
          } catch (e) {
            if (!this.running) break
            if (e instanceof NetworkDownError || e instanceof TypeError || (e as Error).name === 'TimeoutError') {
              if (this.online) this.everOffline = true
              this.online = false
            }
            gap = errGapMs
          }
          if (this.running && gap > 0) await new Promise((r) => setTimeout(r, gap))
        }
      })()
    this.loops = [
      forever(() => this.heartbeat(), this.opts.heartbeatMs),
      forever(() => this.pollCommands(), 0, 1_000),
      forever(async () => {
        await this.flushEvents()
        await this.reportStatus()
      }, this.opts.flushMs),
      forever(async () => this.tick(), this.opts.tickMs),
    ]
  }

  async stop() {
    this.running = false
    this.abort.abort()
    await Promise.allSettled(this.loops)
  }
}
