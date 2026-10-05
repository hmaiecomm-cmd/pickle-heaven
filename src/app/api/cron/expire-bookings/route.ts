import { NextResponse } from 'next/server'
import { releaseExpiredHolds } from '@/lib/availability'
import { completePastBookings, expireStaleBookings } from '@/server/booking-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 定期維護作業（由 Vercel Cron 呼叫，見 vercel.json）：
 *  1. 釋放逾時的購物車暫扣
 *  2. 將逾時未付款的訂單標記為 EXPIRED 並釋放時段、退回點數
 *  3. 將已結束的訂單標記為 COMPLETED
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  // Vercel Cron 會帶入 Authorization: Bearer $CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const [holds, expired, completed] = await Promise.all([
    releaseExpiredHolds(),
    expireStaleBookings(),
    completePastBookings(),
  ])

  return NextResponse.json({ ok: true, releasedHolds: holds, expiredBookings: expired, completed })
}
