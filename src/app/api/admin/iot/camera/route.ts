/**
 * 即時監控用的攝影機 API（經 IoT Gateway 向目前連線的場館電腦／模擬器要影像）
 *
 * POST { action: 'live', camera }                      → { session }（直播 120 秒；觀看中每 90 秒再送一次延長）
 * POST { action: 'renew', camera, session }            → 延長直播
 * POST { action: 'stop', session }
 * POST { action: 'index', cameras?, from, to }         → { id }（NVR 錄影索引，完成後 GET view=index）
 * POST { action: 'clip', camera, from, to }            → { session }（調閱錄影，最長 10 分鐘）
 * GET  ?view=media&session=   ?view=index&id=   ?view=command&id=
 */

import { NextRequest } from 'next/server'
import { CLIP_MAX_SECONDS, NVR_RETENTION_DAYS } from '@gh/iot-contract'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { gatewayErrorResponse } from '@/server/iot/edge-logs'
import { engineerSiteId, mustVenue, sendCommand } from '@/server/iot/engineer'
import { GatewayError, gateway } from '@/server/iot/gateway-client'

export const dynamic = 'force-dynamic'

const CAM = /^(0[1-9]|1[0-6])$/
const newSession = (p: string) => `${p}-${crypto.randomUUID()}`

export async function POST(req: NextRequest) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  try {
    const b = (await req.json().catch(() => null)) ?? {}
    const v = await mustVenue(ctx, null)
    const camera = String(b.camera ?? '')
    if (b.action === 'live' || b.action === 'renew') {
      if (!CAM.test(camera)) throw new GatewayError(400, 'VALIDATION', '攝影機編號錯誤')
      const session = b.action === 'renew' && typeof b.session === 'string' ? b.session : newSession('live')
      await sendCommand(ctx, v, { command: { type: 'camera.live', camera, session, seconds: 120 }, ttlSec: 30 })
      return Response.json({ session, site: engineerSiteId(v) })
    }
    if (b.action === 'stop') {
      await sendCommand(ctx, v, { command: { type: 'camera.stop', session: String(b.session ?? '') }, ttlSec: 30 })
      return Response.json({ ok: true })
    }
    if (!can(ctx.role, 'camera.playback')) return Response.json({ error: '沒有錄影回放權限' }, { status: 403 })
    const from = new Date(String(b.from ?? ''))
    const to = new Date(String(b.to ?? ''))
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new GatewayError(400, 'VALIDATION', '時間範圍錯誤')
    if (from.getTime() < Date.now() - NVR_RETENTION_DAYS * 86_400_000) throw new GatewayError(400, 'VALIDATION', `NVR 只保存 ${NVR_RETENTION_DAYS} 天`)
    if (b.action === 'index') {
      const cameras = Array.isArray(b.cameras) ? b.cameras.filter((c: unknown) => typeof c === 'string' && CAM.test(c)) : undefined
      const r = await sendCommand(ctx, v, { command: { type: 'nvr.index', cameras, from: from.toISOString(), to: to.toISOString() }, ttlSec: 120 })
      return Response.json({ id: r.id })
    }
    if (b.action === 'clip') {
      if (!CAM.test(camera)) throw new GatewayError(400, 'VALIDATION', '攝影機編號錯誤')
      if (to.getTime() - from.getTime() > CLIP_MAX_SECONDS * 1000) throw new GatewayError(400, 'VALIDATION', `一次最多調閱 ${CLIP_MAX_SECONDS / 60} 分鐘`)
      const session = newSession('clip')
      await sendCommand(ctx, v, { command: { type: 'nvr.clip', camera, session, from: from.toISOString(), to: to.toISOString() }, ttlSec: 120 })
      return Response.json({ session, site: engineerSiteId(v) })
    }
    return Response.json({ error: '未知 action' }, { status: 400 })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}

export async function GET(req: NextRequest) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  try {
    const v = await mustVenue(ctx, null)
    const q = req.nextUrl.searchParams
    const site = engineerSiteId(v)
    if (q.get('view') === 'media') return Response.json(await gateway.mediaInfo(site, q.get('session') ?? ''))
    if (q.get('view') === 'index') return Response.json(await gateway.nvrIndex(site, q.get('id') ?? ''))
    if (q.get('view') === 'command') {
      const r = await gateway.command(q.get('id') ?? '')
      if (r.siteId !== site) throw new GatewayError(404, 'NOT_FOUND', '找不到指令')
      return Response.json(r)
    }
    return Response.json({ site })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
