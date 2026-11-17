import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyDoorCode } from '@/server/slot-password-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 門鎖（密碼鍵盤／樹莓派）輸入六位數密碼時呼叫，決定是否開門。
 *   POST /api/door/verify-code   Authorization: Bearer $DOOR_DEVICE_SECRET
 *   body: { "venueId": "...", "code": "004281" }
 *
 * 必須同時符合：密碼正確、已到開放時間、未過失效時間、時段為 ACTIVE、有效訂單數 > 0、門禁授權仍有效。
 * 共用時段密碼無法辨識是哪位顧客輸入：時段仍有其他有效訂單時，已取消的顧客若記得密碼仍可能開門；
 * 時段沒有任何有效訂單時則一律拒絕。
 */
export async function POST(req: Request) {
  const secret = process.env.DOOR_DEVICE_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const body = (await req.json().catch(() => null)) as { venueId?: string; code?: string } | null
  if (!body?.venueId || typeof body.code !== 'string') {
    return NextResponse.json({ allow: false, reason: 'BAD_REQUEST', message: '缺少 venueId 或 code' }, { status: 400 })
  }
  const result = await verifyDoorCode(body.venueId, body.code)
  await prisma.auditLog
    .create({
      data: {
        actor: 'door-device',
        action: result.ok ? 'DOOR_CODE_ACCEPTED' : 'DOOR_CODE_REJECTED',
        target: body.venueId,
        // 不記錄輸入的密碼本身
        detail: result.ok ? { slotPasswordId: result.slotPasswordId } : { reason: result.reason },
      },
    })
    .catch(() => {})
  return result.ok
    ? NextResponse.json({ allow: true, slotPasswordId: result.slotPasswordId })
    : NextResponse.json({ allow: false, reason: result.reason, message: result.message })
}
