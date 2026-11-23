/**
 * 工程測試頁 API（/admin/engineer_testmode）
 *
 * GET  /api/admin/engineer?venue=&view=overview|commands|traffic|errors|media|nvr&id=
 * POST /api/admin/engineer  { venue, action: 'target', target: 'LIVE'|'SIMULATOR' }
 *                           { venue, action: 'push' }
 *                           { venue, action: 'command', command, ttlSec?, id?, confirmLive? }
 */

import { NextRequest } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { gatewayErrorResponse } from '@/server/iot/edge-logs'
import { commandsView, engineerVenues, errorsView, mediaView, mustVenue, nvrIndexView, overview, sendCommand, setTarget, trafficView, connectionView } from '@/server/iot/engineer'
import { gateway } from '@/server/iot/gateway-client'
import { normalizeTarget } from '@/server/iot/site-id'
import { pushSitePlan } from '@/server/iot/sync'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await pagePermission('device.control')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  const q = req.nextUrl.searchParams
  try {
    const view = q.get('view') ?? 'overview'
    if (view === 'venues') return Response.json({ venues: await engineerVenues(ctx) })
    const v = await mustVenue(ctx, q.get('venue'))
    if (view === 'overview') return Response.json(await overview(v))
    if (view === 'commands') return Response.json(await commandsView(v))
    if (view === 'connection') return Response.json(await connectionView(v))
    if (view === 'traffic') return Response.json(await trafficView(v, Number(q.get('limit') ?? 200)))
    if (view === 'errors') return Response.json(await errorsView(ctx, v))
    if (view === 'media') return Response.json(await mediaView(v))
    if (view === 'nvr') return Response.json(await nvrIndexView(v, q.get('id') ?? ''))
    if (view === 'command') return Response.json(await gateway.command(q.get('id') ?? ''))
    return Response.json({ error: '未知 view' }, { status: 400 })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const ctx = await pagePermission('device.control')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  try {
    const body = (await req.json().catch(() => null)) ?? {}
    const v = await mustVenue(ctx, typeof body.venue === 'string' ? body.venue : null)
    if (body.action === 'target') return Response.json(await setTarget(ctx, v, normalizeTarget(body.target)))
    if (body.action === 'push') return Response.json((await pushSitePlan(v.id)) ?? { skipped: true })
    if (body.action === 'command') return Response.json(await sendCommand(ctx, v, body), { status: 201 })
    return Response.json({ error: '未知 action' }, { status: 400 })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
