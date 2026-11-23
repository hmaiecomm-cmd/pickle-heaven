/**
 * 管理員 API：下載場館上傳的 log 原文（JSON Lines）
 *
 * GET /api/admin/iot/logs/{調閱 id}?site=xindian001&file=edge|audit|modbus
 */

import { NextRequest } from 'next/server'
import { LOG_FILES, type LogFile } from '@gh/iot-contract'
import { pagePermission } from '@/lib/admin-auth'
import { gateway } from '@/server/iot/gateway-client'
import { gatewayErrorResponse, mustEdgeSite } from '@/server/iot/edge-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await pagePermission('audit')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  const { id } = await params
  const file = req.nextUrl.searchParams.get('file') as LogFile
  if (!LOG_FILES.includes(file) || !/^[\w-]{8,80}$/.test(id)) return Response.json({ error: '參數錯誤' }, { status: 400 })
  try {
    const site = await mustEdgeSite(ctx, req.nextUrl.searchParams.get('site'))
    const res = await gateway.logFile(site.siteCode, id, file)
    const name = `${site.siteCode}-${file}-${id.slice(4, 12)}.jsonl`
    return new Response(res.body, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Content-Disposition': `${req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
        'Cache-Control': 'no-store',
        'X-Log-Lines': res.headers.get('x-log-lines') ?? '',
        'X-Log-Truncated': res.headers.get('x-log-truncated') ?? '',
      },
    })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
