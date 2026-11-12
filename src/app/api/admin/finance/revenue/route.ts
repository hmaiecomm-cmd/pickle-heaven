import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { isFinanceRange, resolveFinanceRange } from '@/lib/finance-range'
import { allocateCollected, collectedBookings } from '@/server/finance-metrics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 營收明細（Phase 2）。
 * 每筆場地或活動明細一列，訂單實收按原價比例分攤；全部列加總等於期間實收（與營運總覽一致）。
 * 目前只有場地預約（type = COURT）；球敘報名尚無收費紀錄。
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi('finance'))) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入，或目前帳號沒有這項權限' } }, { status: 403 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  if (!isFinanceRange(range)) return NextResponse.json({ success: false, error: { code: 'BAD_RANGE', message: '期間參數不正確' } }, { status: 400 })

  const { from, to } = resolveFinanceRange(range)
  const bookings = await collectedBookings({ fromUtc: from, toUtc: to }, 1000)

  const rows = bookings.flatMap((b) =>
    allocateCollected(b).map((line) => ({
      id: line.id,
      date: (b.paidAt ?? b.createdAt).toISOString(),
      courtId: line.courtId,
      courtName: line.label,
      type: line.type,
      reservationId: b.code,
      amount: line.amount,
      paymentMethod: b.payments[0]?.method ?? 'UNKNOWN',
    })),
  )

  return NextResponse.json({
    success: true,
    data: rows,
    meta: { total: rows.length, dateRange: { from: from.toISOString(), to: to.toISOString() } },
  })
}
