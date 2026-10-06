import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'
import { isFinanceRange, resolveFinanceRange } from '@/lib/finance-range'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 財務摘要（Phase 2）。
 * 營收來自 Booking（已付款／已完成，以 paidAt 歸屬期間）。
 * 費用尚無資料表，回傳 0；前端在 Expense 表接上前仍以 mock 費用補齊。
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入' } }, { status: 401 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  if (!isFinanceRange(range)) return NextResponse.json({ success: false, error: { code: 'BAD_RANGE', message: '期間參數不正確' } }, { status: 400 })

  const { from, to } = resolveFinanceRange(range)
  const agg = await prisma.booking.aggregate({
    where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: from, lt: to } },
    _sum: { total: true },
    _count: { _all: true },
  })
  const grossRevenue = agg._sum.total ?? 0

  return NextResponse.json({
    success: true,
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      grossRevenue,
      expenses: 0,
      netRevenue: grossRevenue,
      operatingProfit: grossRevenue,
      profitMargin: grossRevenue > 0 ? 100 : 0,
    },
    meta: { total: agg._count._all, dateRange: { from: from.toISOString(), to: to.toISOString() }, expensesSource: 'none' },
  })
}
