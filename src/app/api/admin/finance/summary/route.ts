import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'
import { isFinanceRange, resolveFinanceRange } from '@/lib/finance-range'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 財務摘要（Phase 2）。
 * 營收來自 Booking（已付款／已完成，以 paidAt 歸屬期間）。
 * 費用來自 Expense（已核准，以 submittedAt 歸屬期間）。
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
  const exp = await prisma.expense.aggregate({ where: { status: 'APPROVED', submittedAt: { gte: from, lt: to } }, _sum: { amount: true } })
  const expenses = exp._sum.amount ?? 0
  const netRevenue = grossRevenue - expenses

  return NextResponse.json({
    success: true,
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      grossRevenue,
      expenses,
      netRevenue,
      operatingProfit: netRevenue,
      profitMargin: grossRevenue > 0 ? Math.round((netRevenue / grossRevenue) * 10000) / 100 : 0,
    },
    meta: { total: agg._count._all, dateRange: { from: from.toISOString(), to: to.toISOString() }, expensesSource: 'expense-approved' },
  })
}
