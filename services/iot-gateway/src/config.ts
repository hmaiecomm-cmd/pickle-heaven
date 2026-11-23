/**
 * 環境變數。正式環境（DigitalOcean）全部必填；本機開發可用 STORE=memory 不需要 Postgres／Redis。
 */

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`缺少環境變數 ${name}`)
  return v
}

function num(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${name} 必須是數字`)
  return n
}

export interface GatewayConfig {
  port: number
  /** memory：單機開發／測試；postgres：正式（需 DATABASE_URL、REDIS_URL） */
  store: 'memory' | 'postgres'
  databaseUrl?: string
  redisUrl?: string
  /** 派生各場館金鑰用的主金鑰（≥ 32 字元） */
  siteMasterKey: string
  /** 平台（Vercel）呼叫 Gateway 內部 API 的金鑰 */
  platformSecret: string
  /** 加密保存場館計畫（含門禁明碼）的金鑰，32 bytes base64 */
  dataKey: string
  /** Gateway 回報平台的 webhook 網址與金鑰；未設定則不回報 */
  webhookUrl?: string
  webhookSecret?: string
  /** 長輪詢最長等待秒數 */
  maxWaitSec: number
  /** 超過這麼久沒心跳視為離線 */
  offlineAfterSec: number
  /** 指令預設有效秒數 */
  defaultCommandTtlSec: number
  /** 已送達但沒收到 ack，多久後重送 */
  redeliverAfterSec: number
  /** 每個場館每分鐘請求上限 */
  rateLimitPerMin: number
  instanceId: string
}

export function loadConfig(env = process.env): GatewayConfig {
  const store = (env.STORE ?? 'postgres') as GatewayConfig['store']
  if (store !== 'memory' && store !== 'postgres') throw new Error('STORE 只能是 memory 或 postgres')
  const cfg: GatewayConfig = {
    port: num('PORT', 8080),
    store,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    siteMasterKey: req('SITE_MASTER_KEY'),
    platformSecret: req('PLATFORM_SECRET'),
    dataKey: req('DATA_KEY'),
    webhookUrl: env.WEBHOOK_URL || undefined,
    webhookSecret: env.WEBHOOK_SECRET || undefined,
    maxWaitSec: num('MAX_WAIT_SEC', 25),
    offlineAfterSec: num('OFFLINE_AFTER_SEC', 90),
    defaultCommandTtlSec: num('DEFAULT_COMMAND_TTL_SEC', 30),
    redeliverAfterSec: num('REDELIVER_AFTER_SEC', 20),
    rateLimitPerMin: num('RATE_LIMIT_PER_MIN', 240),
    instanceId: env.HOSTNAME ?? `gw-${process.pid}`,
  }
  if (cfg.siteMasterKey.length < 32) throw new Error('SITE_MASTER_KEY 至少 32 字元')
  if (Buffer.from(cfg.dataKey, 'base64').length !== 32) throw new Error('DATA_KEY 必須是 32 bytes 的 base64')
  if (store === 'postgres' && (!cfg.databaseUrl || !cfg.redisUrl)) throw new Error('STORE=postgres 需要 DATABASE_URL 與 REDIS_URL')
  if (cfg.webhookUrl && !cfg.webhookSecret) throw new Error('設定 WEBHOOK_URL 時必須一併設定 WEBHOOK_SECRET')
  return cfg
}
