import 'server-only'
import { signRequest, type CommandRecord, type EdgeCommand, type LogFile, type LogUploadSummary, type MediaSessionInfo, type NvrIndex, type TrafficEntry,
  type SiteConnection, type ProvisionResponse, type PutPlanResponse, type SitePlan, type SiteSummary } from '@gh/iot-contract'

/**
 * 平台 → IoT Gateway（DigitalOcean）內部 API。
 * 環境變數：
 *   IOT_GATEWAY_URL       例：https://iot-gw.example.com（Load Balancer）
 *   IOT_PLATFORM_SECRET   與 Gateway 的 PLATFORM_SECRET 相同
 *   IOT_WEBHOOK_SECRET    與 Gateway 的 WEBHOOK_SECRET 相同（驗證 /api/iot/webhook）
 */

export function iotGatewayConfig() {
  const url = process.env.IOT_GATEWAY_URL
  const secret = process.env.IOT_PLATFORM_SECRET
  if (!url || !secret) return null
  return { url: url.replace(/\/+$/, ''), secret, webhookSecret: process.env.IOT_WEBHOOK_SECRET ?? null }
}

export class GatewayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function send(method: string, path: string, body?: unknown, timeoutMs = 10_000) {
  const cfg = iotGatewayConfig()
  if (!cfg) throw new GatewayError(0, 'NOT_CONFIGURED', '尚未設定 IoT Gateway（IOT_GATEWAY_URL / IOT_PLATFORM_SECRET）')
  const text = body === undefined ? '' : JSON.stringify(body)
  const res = await fetch(cfg.url + path, {
    method,
    headers: { ...(text ? { 'content-type': 'application/json' } : {}), ...signRequest({ keyId: 'platform', secret: cfg.secret, method, pathWithQuery: path, body: text }) },
    body: text || undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => null)
    throw new GatewayError(res.status, json?.error?.code ?? 'HTTP', json?.error?.message ?? `IoT Gateway 回應 ${res.status}`)
  }
  return res
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  return (await (await send(method, path, body)).json()) as T
}

export const gateway = {
  upsertSite: (siteId: string, name: string, venueId: string) => call<SiteSummary>('PUT', `/internal/v1/sites/${siteId}`, { name, venueId }),
  site: (siteId: string) => call<SiteSummary>('GET', `/internal/v1/sites/${siteId}`),
  sites: () => call<{ sites: SiteSummary[] }>('GET', '/internal/v1/sites'),
  credentials: (siteId: string, rotate = false) => call<ProvisionResponse>('POST', `/internal/v1/sites/${siteId}/credentials${rotate ? '?rotate=true' : ''}`),
  putPlan: (plan: SitePlan) => call<PutPlanResponse>('PUT', `/internal/v1/sites/${plan.siteId}/plan`, plan),
  enqueue: (siteId: string, id: string, command: EdgeCommand, requestedBy: string, ttlSec?: number) =>
    call<CommandRecord>('POST', `/internal/v1/sites/${siteId}/commands`, { id, command, requestedBy, ttlSec }),
  commands: (siteId: string, limit = 50) => call<{ commands: CommandRecord[] }>('GET', `/internal/v1/sites/${siteId}/commands?limit=${limit}`),
  command: (id: string) => call<CommandRecord>('GET', `/internal/v1/commands/${encodeURIComponent(id)}`),
  connection: (siteId: string) => call<SiteConnection>('GET', `/internal/v1/sites/${siteId}/connection`),
  traffic: (siteId: string, limit = 150) => call<{ traffic: TrafficEntry[] }>('GET', `/internal/v1/sites/${siteId}/traffic?limit=${limit}`),
  media: (siteId: string, limit = 30) => call<{ sessions: MediaSessionInfo[] }>('GET', `/internal/v1/sites/${siteId}/media?limit=${limit}`),
  mediaInfo: (siteId: string, session: string) => call<MediaSessionInfo>('GET', `/internal/v1/sites/${siteId}/media/${encodeURIComponent(session)}`),
  /** 播放清單或片段原始回應（給平台代理給瀏覽器播放） */
  mediaFile: (siteId: string, session: string, file: string) => send('GET', `/internal/v1/sites/${siteId}/media/${encodeURIComponent(session)}/${encodeURIComponent(file)}`, undefined, 20_000),
  nvrIndex: (siteId: string, id: string) => call<NvrIndex & { uploadedAt: string }>('GET', `/internal/v1/sites/${siteId}/nvr-index/${encodeURIComponent(id)}`),
  logs: (siteId: string, limit = 20) => call<{ logs: LogUploadSummary[] }>('GET', `/internal/v1/sites/${siteId}/logs?limit=${limit}`),
  /** 下載一個 log 檔的 JSON Lines 原文（串流回傳，不在記憶體組字串） */
  logFile: (siteId: string, id: string, file: LogFile) => send('GET', `/internal/v1/sites/${siteId}/logs/${encodeURIComponent(id)}?file=${file}`, undefined, 30_000),
}
