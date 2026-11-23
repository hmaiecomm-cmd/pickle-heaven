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
  close(): Promise<void>
}

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
  async close() {
    await this.local.close()
    this.sub.disconnect()
    this.cmd.disconnect()
  }
}
