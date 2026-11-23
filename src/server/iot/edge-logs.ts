import 'server-only'
import { randomUUID } from 'node:crypto'
import { LOG_FILES, LOG_LEVELS, type LogFile, type LogLevel } from '@gh/iot-contract'
import type { AdminContext } from '@/lib/admin-auth'
import { clientFor } from '@/lib/db'
import { GatewayError, gateway, iotGatewayConfig } from './gateway-client'

/**
 * 調閱場館電腦（地端）本機 log：
 *   後台按「調閱」→ Gateway 指令 log.upload → 場館篩選後上傳到 Gateway（DigitalOcean Postgres，保存 30 天）
 *   → 後台列表與下載都直接向 Gateway 取，平台資料庫只記一筆稽核
 */

/** 最長可調閱的時間範圍（一次） */
export const MAX_RANGE_HOURS = 72
/** 場館要在多久內開始處理（斷網太久就過期，不補執行） */
const REQUEST_TTL_SEC = 15 * 60

export interface EdgeSite {
  venueId: string
  name: string
  siteCode: string
}

/** 登入者可調閱的場館（有設定場館代碼的才算已串接） */
export async function edgeSitesFor(ctx: AdminContext): Promise<EdgeSite[]> {
  const db = clientFor(ctx.tenant)
  const venues = await db.venue.findMany({
    where: { siteCode: { not: null }, ...(ctx.venueId ? { id: ctx.venueId } : {}) },
    select: { id: true, name: true, siteCode: true },
    orderBy: { name: 'asc' },
  })
  return venues.map((v) => ({ venueId: v.id, name: v.name, siteCode: v.siteCode! }))
}

export async function mustEdgeSite(ctx: AdminContext, siteCode: string | null): Promise<EdgeSite> {
  const site = (await edgeSitesFor(ctx)).find((s) => s.siteCode === siteCode)
  if (!site) throw new GatewayError(404, 'NOT_FOUND', '找不到這個場館，或你沒有這個場館的權限')
  return site
}

export function parseLogRequest(body: unknown, now = new Date()) {
  const b = (body ?? {}) as { files?: unknown; from?: unknown; to?: unknown; minLevel?: unknown }
  const files = Array.isArray(b.files) ? (b.files.filter((f) => LOG_FILES.includes(f as LogFile)) as LogFile[]) : []
  if (files.length === 0) throw new GatewayError(400, 'VALIDATION', '請至少選一個 log 檔')
  const from = new Date(typeof b.from === 'string' ? b.from : NaN)
  const to = new Date(typeof b.to === 'string' ? b.to : NaN)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new GatewayError(400, 'VALIDATION', '請選擇開始與結束時間')
  if (from >= to) throw new GatewayError(400, 'VALIDATION', '開始時間必須早於結束時間')
  if (to.getTime() - from.getTime() > MAX_RANGE_HOURS * 3600_000) throw new GatewayError(400, 'VALIDATION', `一次最多調閱 ${MAX_RANGE_HOURS} 小時`)
  if (from > now) throw new GatewayError(400, 'VALIDATION', '開始時間不能在未來')
  const minLevel = LOG_LEVELS.includes(b.minLevel as LogLevel) ? (b.minLevel as LogLevel) : undefined
  return { files: [...new Set(files)], from: from.toISOString(), to: to.toISOString(), minLevel }
}

export async function requestEdgeLogs(ctx: AdminContext, site: EdgeSite, req: ReturnType<typeof parseLogRequest>) {
  if (!iotGatewayConfig()) throw new GatewayError(0, 'NOT_CONFIGURED', '尚未設定 IoT Gateway')
  const id = `log-${randomUUID()}`
  const actor = `admin:${ctx.username}`
  const record = await gateway.enqueue(site.siteCode, id, { type: 'log.upload', ...req }, actor, REQUEST_TTL_SEC)
  await clientFor(ctx.tenant).auditLog.create({
    data: { actor, action: 'IOT_LOG_REQUESTED', target: site.siteCode, detail: { commandId: id, venueId: site.venueId, ...req } },
  })
  return record
}

export function gatewayErrorResponse(e: unknown) {
  if (e instanceof GatewayError) {
    const status = e.status === 0 ? 503 : e.status >= 500 ? 502 : e.status
    return Response.json({ error: e.message, code: e.code }, { status })
  }
  console.error('[iot/logs]', e)
  return Response.json({ error: '系統忙碌中，請稍後再試' }, { status: 500 })
}
