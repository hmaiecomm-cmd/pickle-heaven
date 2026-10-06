import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'
import { isFinanceRange, resolveFinanceRange } from '@/lib/finance-range'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 營收明細（Phase 2）。
 * 每筆 BookingItem 一列，金額依訂單折扣後總額按比例分攤，各列加總等於訂單 total。
 * 目前只有場地預約（type = COURT）；球敘報名尚無收費紀錄。
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入' } }, { status: 401 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  if (!isFinanceRange(range)) return NextResponse.json({ success: false, error: { code: 'BAD_RANGE', message: '期間參數不正確' } }, { status: 400 })

  const { from, to } = resolveFinanceRange(range)
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: 'desc' },
    take: 1000,
    include: {
      items: { select: { id: true, courtId: true, courtName: true, price: true } },
      payments: { where: { status: 'SUCCESS' }, select: { method: true }, take: 1 },
    },
  })

  const rows = bookings.flatMap((b) => {
    const subtotal = b.items.reduce((s, i) => s + i.price, 0) || 1
    let allocated = 0
    return b.items.map((it, idx) => {
      const last = idx === b.items.length - 1
      const amount = last ? b.total - allocated : Math.round((b.total * it.price) / subtotal)
      allocated += amount
      return {
        id: it.id,
        date: (b.paidAt ?? b.createdAt).toISOString(),
        courtId: it.courtId,
        courtName: it.courtName,
        type: 'COURT' as const,
        reservationId: b.code,
        amount,
        paymentMethod: b.payments[0]?.method ?? 'UNKNOWN',
      }
    })
  })

  return NextResponse.json({
    success: true,
    data: rows,
    meta: { total: rows.length, dateRange: { from: from.toISOString(), to: to.toISOString() } },
  })
}
