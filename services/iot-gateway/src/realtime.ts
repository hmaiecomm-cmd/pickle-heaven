import type { TrafficEntry } from '@gh/iot-contract'
import { Redis } from 'ioredis'

/**
 * 即時層：長輪詢喚醒、nonce 防重送、在線狀態、限流、背景工作鎖。
 * 正式用 Redis（多台 Gateway 共用）；開發／測試用記憶體。
 */
export interface Realtime {
  /** 通知某場館「有新指令或新計畫」，喚醒正在長輪詢的連線（不論連在哪台 Gateway） */
  notify(siteId: string): Promise<void>
  /** 等待通知，最多 ms 毫秒；回傳 true 表示被喚醒 */
  wait(siteId: string, ms: number, signal?: AbortSignal): Promise<boolean>
  /** nonce 第一次出現回傳 true */
  claimNonce(key: string, ttlMs: number): Promise<boolean>
  /** 固定視窗限流：回傳本視窗內第幾次 */
  hit(key: string, windowMs: number): Promise<number>
  setPresence(siteId: string, ttlMs: number): Promise<void>
  isPresent(siteId: string): Promise<boolean>
  /** 背景工作（離線偵測、webhook）只讓一台 Gateway 跑 */
  tryLock(name: string, owner: string, ttlMs: number): Promise<boolean>
  /** 每個場館最近的請求紀錄（環狀，最多 TRAFFIC_KEEP 筆，保留 1 天） */
  pushTraffic(siteId: string, entry: TrafficEntry): Promise<void>
  getTraffic(siteId: string, limit: number): Promise<TrafficEntry[]>
  /** 設定字串值並回傳舊值（連線 IP 用） */
  swap(key: string, value: string, ttlMs: number): Promise<string | null>
  /** 環狀清單：新的在前，保留 keep 筆 */
  pushList(key: string, entry: unknown, keep: number, ttlMs: number): Promise<void>
  getList<T>(key: string, limit: number): Promise<T[]>
  close(): Promise<void>
}

export const TRAFFIC_KEEP = 500

export class MemoryRealtime implements Realtime {
  private waiters = new Map<string, Set<() => void>>()
  private nonces = new Map<string, number>()
  private counters = new Map<string, { n: number; until: number }>()
  private presence = new Map<string, number>()
  private locks = new Map<string, { owner: string; until: number }>()

  async notify(siteId: string) {
    const set = this.waiters.get(siteId)
    if (!set) return
    this.waiters.delete(siteId)
    for (const fn of set) fn()
  }
  wait(siteId: string, ms: number, signal?: AbortSignal) {
    return new Promise<boolean>((resolve) => {
      let done = false
      const finish = (v: boolean) => {
        if (done) return
        done = true
        clearTimeout(timer)
        this.waiters.get(siteId)?.delete(wake)
        resolve(v)
      }
      const wake = () => finish(true)
      const timer = setTimeout(() => finish(false), ms)
      const set = this.waiters.get(siteId) ?? new Set()
      set.add(wake)
      this.waiters.set(siteId, set)
      signal?.addEventListener('abort', () => finish(false), { once: true })
    })
  }
  async claimNonce(key: string, ttlMs: number) {
    const t = Date.now()
    if (this.nonces.size > 50_000) for (const [k, until] of this.nonces) if (until < t) this.nonces.delete(k)
    const until = this.nonces.get(key)
    if (until && until > t) return false
    this.nonces.set(key, t + ttlMs)
    return true
  }
  async hit(key: string, windowMs: number) {
    const t = Date.now()
    const c = this.counters.get(key)
    if (!c || c.until < t) {
      this.counters.set(key, { n: 1, until: t + windowMs })
      return 1
    }
    c.n += 1
    return c.n
  }
  async setPresence(siteId: string, ttlMs: number) {
    this.presence.set(siteId, Date.now() + ttlMs)
  }
  async isPresent(siteId: string) {
    return (this.presence.get(siteId) ?? 0) > Date.now()
  }
  async tryLock(name: string, owner: string, ttlMs: number) {
    const t = Date.now()
    const l = this.locks.get(name)
    if (l && l.until > t && l.owner !== owner) return false
    this.locks.set(name, { owner, until: t + ttlMs })
    return true
  }
  private traffic = new Map<string, TrafficEntry[]>()
  async pushTraffic(siteId: string, entry: TrafficEntry) {
    const list = this.traffic.get(siteId) ?? []
    list.unshift(entry)
    if (list.length > TRAFFIC_KEEP) list.length = TRAFFIC_KEEP
    this.traffic.set(siteId, list)
  }
  async getTraffic(siteId: string, limit: number) {
    return (this.traffic.get(siteId) ?? []).slice(0, limit)
  }
  private kv = new Map<string, { v: string; until: number }>()
  async swap(key: string, value: string, ttlMs: number) {
    const old = this.kv.get(key)
    this.kv.set(key, { v: value, until: Date.now() + ttlMs })
    return old && old.until > Date.now() ? old.v : null
  }
  private lists = new Map<string, unknown[]>()
  async pushList(key: string, entry: unknown, keep: number) {
    const list = this.lists.get(key) ?? []
    list.unshift(entry)
    if (list.length > keep) list.length = keep
    this.lists.set(key, list)
  }
  async getList<T>(key: string, limit: number) {
    return (this.lists.get(key) ?? []).slice(0, limit) as T[]
  }
  async close() {
    for (const set of this.waiters.values()) for (const fn of set) fn()
    this.waiters.clear()
  }
}

/** Redis 版：一條連線下指令，一條連線訂閱 gh:wake 頻道，在本機分派給等待中的長輪詢 */
export class RedisRealtime implements Realtime {
  private cmd: Redis
  private sub: Redis
  private local = new MemoryRealtime()

  constructor(url: string) {
    const opts = { maxRetriesPerRequest: 3, enableAutoPipelining: true, lazyConnect: false }
    this.cmd = new Redis(url, opts)
    this.sub = new Redis(url, opts)
    void this.sub.subscribe('gh:wake')
    this.sub.on('message', (_ch, siteId) => void this.local.notify(siteId))
  }

  async notify(siteId: string) {
    await this.cmd.publish('gh:wake', siteId)
  }
  wait(siteId: string, ms: number, signal?: AbortSignal) {
    return this.local.wait(siteId, ms, signal)
  }
  async claimNonce(key: string, ttlMs: number) {
    return (await this.cmd.set(`gh:nonce:${key}`, '1', 'PX', ttlMs, 'NX')) === 'OK'
  }
  async hit(key: string, windowMs: number) {
    const k = `gh:rl:${key}:${Math.floor(Date.now() / windowMs)}`
    const n = await this.cmd.incr(k)
    if (n === 1) await this.cmd.pexpire(k, windowMs)
    return n
  }
  async setPresence(siteId: string, ttlMs: number) {
    await this.cmd.set(`gh:presence:${siteId}`, String(Date.now()), 'PX', ttlMs)
  }
  async isPresent(siteId: string) {
    return (await this.cmd.exists(`gh:presence:${siteId}`)) === 1
  }
  async tryLock(name: string, owner: string, ttlMs: number) {
    const k = `gh:lock:${name}`
    if ((await this.cmd.set(k, owner, 'PX', ttlMs, 'NX')) === 'OK') return true
    // 自己持有就續約
    if ((await this.cmd.get(k)) === owner) {
      await this.cmd.pexpire(k, ttlMs)
      return true
    }
    return false
  }
  async pushTraffic(siteId: string, entry: TrafficEntry) {
    const k = `gh:traffic:${siteId}`
    await this.cmd.multi().lpush(k, JSON.stringify(entry)).ltrim(k, 0, TRAFFIC_KEEP - 1).expire(k, 86_400).exec()
  }
  async getTraffic(siteId: string, limit: number) {
    return (await this.cmd.lrange(`gh:traffic:${siteId}`, 0, limit - 1)).map((s) => JSON.parse(s) as TrafficEntry)
  }
  async swap(key: string, value: string, ttlMs: number) {
    const k = `gh:kv:${key}`
    const [[, old]] = (await this.cmd.multi().get(k).set(k, value, 'PX', ttlMs).exec()) as [[unknown, string | null], unknown]
    return old ?? null
  }
  async pushList(key: string, entry: unknown, keep: number, ttlMs: number) {
    const k = `gh:list:${key}`
    await this.cmd.multi().lpush(k, JSON.stringify(entry)).ltrim(k, 0, keep - 1).pexpire(k, ttlMs).exec()
  }
  async getList<T>(key: string, limit: number) {
    return (await this.cmd.lrange(`gh:list:${key}`, 0, limit - 1)).map((s) => JSON.parse(s) as T)
  }
  async close() {
    await this.local.close()
    this.sub.disconnect()
    this.cmd.disconnect()
  }
}
