import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  HEADER_NONCE,
  HEADER_SIG,
  HEADER_TS,
  verifySignature,
  type CommandRecord,
  type EdgeCommand,
  type LogUploadSummary,
  type ProvisionResponse,
  type PutPlanResponse,
  type SitePlan,
  type SiteSummary,
  type WebhookEnvelope,
  type WebhookPayload,
} from '../../../packages/iot-contract/src/index'
import { startEmbeddedGateway } from '../../../services/iot-gateway/src/embedded'
import { EdgeAgent, type AgentOptions } from './agent'
import { signedFetch } from './http'

/** 可手動撥動的場館時鐘（排程、門禁、廣播都用它；網路簽章仍用真實時間） */
export class ManualClock {
  constructor(public t: number) {}
  now() {
    return this.t
  }
  set(t: number) {
    this.t = t
  }
  advance(ms: number) {
    this.t += ms
  }
}

/** 扮演「顧好平台」呼叫 Gateway 內部 API */
export class PlatformClient {
  constructor(
    readonly baseUrl: string,
    private readonly secret: string,
  ) {}
  private req<T>(method: string, path: string, body?: unknown) {
    return signedFetch({ baseUrl: this.baseUrl, keyId: 'platform', secret: this.secret, method, path, body }).then((r) => r.json as T)
  }
  upsertSite(siteId: string, name: string, venueId?: string) {
    return this.req<SiteSummary>('PUT', `/internal/v1/sites/${siteId}`, { name, venueId })
  }
  credentials(siteId: string, rotate = false) {
    return this.req<ProvisionResponse>('POST', `/internal/v1/sites/${siteId}/credentials${rotate ? '?rotate=true' : ''}`)
  }
  site(siteId: string) {
    return this.req<SiteSummary>('GET', `/internal/v1/sites/${siteId}`)
  }
  putPlan(plan: SitePlan) {
    return this.req<PutPlanResponse>('PUT', `/internal/v1/sites/${plan.siteId}/plan`, plan)
  }
  enqueue(siteId: string, id: string, command: EdgeCommand, ttlSec?: number) {
    return this.req<CommandRecord>('POST', `/internal/v1/sites/${siteId}/commands`, { id, command, ttlSec, requestedBy: 'simulator' })
  }
  command(id: string) {
    return this.req<CommandRecord>('GET', `/internal/v1/commands/${id}`)
  }
  logs(siteId: string) {
    return this.req<{ logs: LogUploadSummary[] }>('GET', `/internal/v1/sites/${siteId}/logs`)
  }
  logFile(siteId: string, id: string, file: string) {
    return signedFetch({ baseUrl: this.baseUrl, keyId: 'platform', secret: this.secret, method: 'GET', path: `/internal/v1/sites/${siteId}/logs/${id}?file=${file}`, raw: true }).then((r) => r.text)
  }
  disable(siteId: string) {
    return this.req('POST', `/internal/v1/sites/${siteId}/disable`)
  }
  enable(siteId: string) {
    return this.req('POST', `/internal/v1/sites/${siteId}/enable`)
  }
}

/** 扮演平台的 /api/iot/webhook：驗章後收集 Gateway 回報 */
export class WebhookSink {
  readonly received: WebhookEnvelope[] = []
  rejected = 0
  private server: Server | null = null
  constructor(private readonly secret: string) {}

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const v = verifySignature({
          secret: this.secret,
          method: req.method ?? 'POST',
          pathWithQuery: req.url ?? '/',
          body,
          headers: { ts: req.headers[HEADER_TS] as string, nonce: req.headers[HEADER_NONCE] as string, sig: req.headers[HEADER_SIG] as string },
        })
        if (!v.ok) {
          this.rejected++
          res.writeHead(401).end()
          return
        }
        this.received.push(JSON.parse(body))
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
      })
    })
    // 與 Vercel 一樣保持連線久一點，避免 Gateway 重用到已被關閉的 keep-alive 連線
    this.server.keepAliveTimeout = 65_000
    await new Promise<void>((r) => this.server!.listen(0, '127.0.0.1', () => r()))
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/api/iot/webhook`
  }
  payloads<K extends WebhookPayload['kind']>(kind: K, siteId?: string): Extract<WebhookPayload, { kind: K }>[] {
    return this.received.map((e) => e.payload).filter((p): p is Extract<WebhookPayload, { kind: K }> => p.kind === kind && (!siteId || p.siteId === siteId))
  }
  async stop() {
    await new Promise((r) => (this.server ? this.server.close(() => r(null)) : r(null)))
    ;(this.server as any)?.closeAllConnections?.()
  }
}

export async function waitUntil(pred: () => boolean | Promise<boolean>, timeoutMs = 8_000, label = '條件'): Promise<void> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await pred()) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`等待逾時：${label}`)
}

export interface Ctx {
  gatewayUrl: string
  platform: PlatformClient
  sink: WebhookSink
  clock: ManualClock
  agents: EdgeAgent[]
  /** 開通一個場館並建立模擬場館電腦（尚未 start） */
  newSite(siteId: string, opts?: Partial<AgentOptions>): Promise<EdgeAgent>
  log: (msg: string) => void
}

/** 啟動嵌入式 Gateway＋webhook 接收端；外部 Gateway 則給 url/platformSecret */
export async function createContext(o: { gatewayUrl?: string; platformSecret?: string; verbose?: boolean; startAt: number }) {
  const webhookSecret = 'sim-webhook-secret'
  const sink = new WebhookSink(webhookSecret)
  const sinkUrl = await sink.start()
  const embedded = o.gatewayUrl ? null : await startEmbeddedGateway({ webhookUrl: sinkUrl, webhookSecret, offlineAfterSec: 3, redeliverAfterSec: 2 })
  const gatewayUrl = o.gatewayUrl ?? embedded!.url
  const platform = new PlatformClient(gatewayUrl, o.platformSecret ?? embedded!.cfg.platformSecret)
  const clock = new ManualClock(o.startAt)
  const log = (m: string) => o.verbose && console.log(`    · ${m}`)
  const ctx: Ctx = {
    gatewayUrl,
    platform,
    sink,
    clock,
    agents: [],
    log,
    async newSite(siteId, opts = {}) {
      await platform.upsertSite(siteId, `模擬場館 ${siteId}`)
      const cred = await platform.credentials(siteId)
      const agent = new EdgeAgent({ baseUrl: gatewayUrl, siteId, secret: cred.secret, clock, heartbeatMs: 400, flushMs: 200, tickMs: 200, pollWaitSec: 3, log, ...opts })
      ctx.agents.push(agent)
      return agent
    },
  }
  return {
    ctx,
    async close() {
      await Promise.all(ctx.agents.map((a) => a.stop()))
      await embedded?.close()
      await sink.stop()
    },
  }
}
