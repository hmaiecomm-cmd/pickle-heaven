import { NextResponse } from 'next/server'
import { runSlotPasswordMaintenance } from '@/server/slot-password-integration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 時段共用密碼排程（Vercel Cron 每 15 分鐘，帶 Authorization: Bearer $CRON_SECRET）
 * 1. 依時間推進時段狀態（SCHEDULED → ACTIVE → EXPIRED）
 * 2. 批次補產生未來 1～30 天（依業主規則）已付款訂單的時段密碼（冪等，不會產生第二組）
 * 3. 重試 LINE 發送失敗的密碼通知（未綁定 LINE 的會員不重試，等綁定後由後台重新發送）
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await runSlotPasswordMaintenance()) })
  } catch (err) {
    console.error('[cron/slot-passwords] 執行失敗', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' }, { status: 500 })
  }
}
