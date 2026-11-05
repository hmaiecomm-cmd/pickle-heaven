import { NextResponse } from 'next/server'
import { sendDueReminders } from '@/server/booking-reminders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 預約的 LINE 開打提醒（前一天、前兩小時）。
 * 由 Vercel Cron 每 15 分鐘呼叫（見 vercel.json），會帶入 Authorization: Bearer $CRON_SECRET。
 * 以 NotificationLog 去重，重複呼叫不會重複發送。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await sendDueReminders()) })
  } catch (err) {
    console.error('[cron/reminders] 執行失敗', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' },
      { status: 500 },
    )
  }
}
