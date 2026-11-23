/**
 * 攝影機影像代理：瀏覽器播放 HLS（index.m3u8 與 N.ts）→ 平台驗權限 → 以平台身分向 Gateway 取。
 * 播放清單裡的片段是相對路徑，會自動解析回這個代理。
 *
 * GET /api/admin/iot-media/{Gateway 場館 ID}/{session}/{index.m3u8 | N.ts}
 */

import { pagePermission } from '@/lib/admin-auth'
import { gatewayErrorResponse } from '@/server/iot/edge-logs'
import { engineerVenues } from '@/server/iot/engineer'
import { gateway } from '@/server/iot/gateway-client'
import { siteIdFor } from '@/server/iot/site-id'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ site: string; session: string; file: string }> }) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return Response.json({ error: '權限不足' }, { status: 403 })
  const { site, session, file } = await params
  if (!/^[a-z0-9-]{3,48}$/.test(site) || !/^[a-z0-9-]{8,64}$/.test(session) || !/^(index\.m3u8|\d{1,6}\.ts)$/.test(file)) return Response.json({ error: '參數錯誤' }, { status: 400 })
  try {
    const allowed = (await engineerVenues(ctx)).some((v) => site === siteIdFor(v.siteCode, 'LIVE') || site === siteIdFor(v.siteCode, 'SIMULATOR'))
    if (!allowed) return Response.json({ error: '沒有這個場館的權限' }, { status: 403 })
    const res = await gateway.mediaFile(site, session, file)
    return new Response(res.body, { headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream', 'Cache-Control': file.endsWith('.m3u8') ? 'no-store' : 'private, max-age=600' } })
  } catch (e) {
    return gatewayErrorResponse(e)
  }
}
