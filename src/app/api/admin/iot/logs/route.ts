/**
 * 管理員 API：調閱場館電腦（地端）本機 log
 *
 * GET  /api/admin/iot/logs?site=xindian001   最近的調閱紀錄與上傳狀態
 * POST /api/admin/iot/logs                   { site, files: ['edge','audit','modbus'], from, to, minLevel? }
 */

import { NextRequest } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { gateway } from '@/server/iot/gateway-client'
import { gatewayErrorResponse, mustEdgeSite, parseLogRequest, requestEdgeLogs } from '@/server/iot/edge-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await pagePermission('audit')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  try {
    const site = await mustEdgeSite(ctx, req.nextUrl.searchParams.get('site'))
    return Response.json(await gateway.logs(site.siteCode))
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const ctx = await pagePermission('audit')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  try {
    const body = await req.json().catch(() => null)
    const site = await mustEdgeSite(ctx, typeof body?.site === 'string' ? body.site : null)
    const record = await requestEdgeLogs(ctx, site, parseLogRequest(body))
    return Response.json({ id: record.id, status: record.status }, { status: 201 })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
