import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startEmbeddedGateway } from '../../../services/iot-gateway/src/embedded'
import { EdgeAgent } from './agent'
import { OffsetClock, startConsole } from './console'
import { PlatformClient } from './harness'

/**
 * 互動測試環境（一個指令）：
 *   本機 IoT Gateway（記憶體版，:8787）＋ 場館模擬器網頁（:4310，扮演 xindian001-sim 場館電腦）
 *   並把 IOT_* 寫進 .env.development.local，讓 `npm run dev` 的平台連到這個 Gateway。
 *
 *   npm run iot:stack
 *   npm run iot:stack -- --site xindian001-sim --platform-url http://127.0.0.1:3100
 *
 * 連 DigitalOcean 上的 Gateway（staging）時改用：
 *   npm run iot:console -- --gateway https://<staging> --site xindian001-sim --platform-secret <PLATFORM_SECRET>
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DEV_DIR = join(ROOT, '.iot-dev')

function secrets() {
  mkdirSync(DEV_DIR, { recursive: true })
  const file = join(DEV_DIR, 'secrets.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const s = {
    siteMasterKey: randomBytes(32).toString('base64url'),
    platformSecret: randomBytes(32).toString('base64url'),
    webhookSecret: randomBytes(32).toString('base64url'),
    dataKey: randomBytes(32).toString('base64'),
  }
  writeFileSync(file, JSON.stringify(s, null, 2))
  return s
}

/** 只改 IOT_* 這幾行，其他設定保留 */
function writeDevEnv(values: Record<string, string>) {
  const file = join(ROOT, '.env.development.local')
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : ['# 本機開發專用（next dev 會讀，正式部署不會）。由 npm run iot:stack 產生。']
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`))
    if (i >= 0) lines[i] = `${k}=${v}`
    else lines.push(`${k}=${v}`)
  }
  writeFileSync(file, lines.filter((l, i, a) => !(l === '' && i === a.length - 1)).join('\n') + '\n')
  return file
}

export async function runStack(o: { site: string; platformUrl: string; gatewayPort: number; consolePort: number; label: string; floatingIpEveryMin?: number }) {
  const s = secrets()
  const gw = await startEmbeddedGateway({
    port: o.gatewayPort,
    siteMasterKey: s.siteMasterKey,
    platformSecret: s.platformSecret,
    dataKey: s.dataKey,
    webhookUrl: `${o.platformUrl.replace(/\/+$/, '')}/api/iot/webhook`,
    webhookSecret: s.webhookSecret,
    rateLimitPerMin: 600,
    instanceId: 'local-stack',
  })
  const gatewayUrl = `http://127.0.0.1:${o.gatewayPort}`
  const envFile = writeDevEnv({ IOT_GATEWAY_URL: gatewayUrl, IOT_PLATFORM_SECRET: s.platformSecret, IOT_WEBHOOK_SECRET: s.webhookSecret })

  const platform = new PlatformClient(gatewayUrl, s.platformSecret)
  await platform.upsertSite(o.site, o.label)
  const cred = await platform.credentials(o.site)
  const clock = new OffsetClock()
  const agent = new EdgeAgent({ baseUrl: gatewayUrl, siteId: o.site, secret: cred.secret, clock, heartbeatMs: 10_000, flushMs: 2_000, media: true, recordTraffic: true, agentVersion: 'sim-console-1.0', floatingIpEveryMin: o.floatingIpEveryMin ?? 30 })
  agent.start()
  startConsole(agent, { port: o.consolePort, clock, gatewayUrl, label: o.label, platformUrl: o.platformUrl })

  console.log(`
════════════════════════════════════════════════════════════
 本機 IoT Gateway     ${gatewayUrl}（記憶體版，重開會清空；平台推計畫時會自動重建場館）
 場館模擬器（地端）   http://127.0.0.1:${o.consolePort}   場館 ID：${o.site}
 平台 webhook         ${o.platformUrl}/api/iot/webhook
 已寫入 ${envFile}
   → 平台要（重新）啟動 npm run dev 才會讀到 IOT_* 設定
 平台後台「系統設定 → 地端 IoT（工程測試）」/admin/engineer_testmode：切換實體／模擬器、看下行參數、跑測試台
════════════════════════════════════════════════════════════`)

  const shutdown = async () => {
    await agent.stop()
    await gw.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

/**
 * 只開模擬器網頁，連到既有的 Gateway（DigitalOcean staging 或雲端部署本身）。
 * 有 platformSecret 時：開機自動開通場館；Gateway 重開（記憶體版會清空）導致「場館未開通」時自動重新開通。
 */
export async function runConsole(o: {
  gateway: string
  site: string
  secret?: string
  platformSecret?: string
  consolePort: number
  label: string
  host?: string
  password?: string
  cloud?: boolean
  floatingIpEveryMin?: number
}) {
  const platform = o.platformSecret ? new PlatformClient(o.gateway, o.platformSecret) : null
  const provision = async () => {
    await platform!.upsertSite(o.site, o.label)
    return (await platform!.credentials(o.site)).secret
  }
  let secret = o.secret
  if (!secret && platform) {
    // 同一個部署裡 Gateway 可能比模擬器晚起來：重試 2 分鐘
    for (let i = 0; ; i++) {
      try {
        secret = await provision()
        break
      } catch (e) {
        if (i >= 24) throw e
        console.log(`等待 Gateway ${o.gateway}…（${(e as Error).message}）`)
        await new Promise((r) => setTimeout(r, 5_000))
      }
    }
  }
  if (!secret) throw new Error('需要 --secret <場館金鑰> 或 --platform-secret <PLATFORM_SECRET>')
  const clock = new OffsetClock()
  const agent = new EdgeAgent({ baseUrl: o.gateway, siteId: o.site, secret, clock, heartbeatMs: 10_000, media: true, recordTraffic: true, agentVersion: o.cloud ? 'sim-cloud-1.0' : 'sim-console-1.0', floatingIpEveryMin: o.floatingIpEveryMin ?? 30 })
  agent.start()
  startConsole(agent, { port: o.consolePort, clock, gatewayUrl: o.gateway, label: o.label, host: o.host, password: o.password, cloud: o.cloud })
  if (platform) {
    setInterval(() => {
      if (agent.online || !/場館未開通/.test(agent.lastError ?? '')) return
      void provision()
        .then(() => console.log('Gateway 找不到場館（可能重開過），已重新開通'))
        .catch(() => {})
    }, 15_000).unref()
  }
  const shutdown = async () => {
    await agent.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

/** 雲端部署（DigitalOcean App Platform）：全部設定走環境變數 */
export async function runCloud(env = process.env) {
  const gateway = env.GATEWAY_URL
  if (!gateway) throw new Error('需要環境變數 GATEWAY_URL')
  if (!env.CONSOLE_PASSWORD) throw new Error('雲端模擬器必須設定 CONSOLE_PASSWORD（網頁密碼）')
  await runConsole({
    gateway,
    site: env.SITE_ID ?? 'xindian001-sim',
    secret: env.SITE_SECRET,
    platformSecret: env.PLATFORM_SECRET,
    consolePort: Number(env.PORT ?? 8080),
    label: env.SITE_LABEL ?? '大新店（雲端模擬器）',
    host: '0.0.0.0',
    password: env.CONSOLE_PASSWORD,
    cloud: true,
    floatingIpEveryMin: Number(env.FLOATING_IP_EVERY_MIN ?? 30),
  })
}
