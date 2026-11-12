import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { isFinanceRange, resolveFinanceRange } from '@/lib/finance-range'
import { METRIC_BASIS, financeTotals } from '@/server/finance-metrics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 財務摘要：數字一律由 finance-metrics 計算，與營運總覽一致 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi('finance'))) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入，或目前帳號沒有這項權限' } }, { status: 403 })

  const range = req.nextUrl.searchParams.get('range') ?? 'month'
  if (!isFinanceRange(range)) return NextResponse.json({ success: false, error: { code: 'BAD_RANGE', message: '期間參數不正確' } }, { status: 400 })

  const { from, to } = resolveFinanceRange(range)
  const t = await financeTotals({ fromUtc: from, toUtc: to })
  const netAfterExpenses = t.net - t.expenses

  return NextResponse.json({
    success: true,
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      collected: t.collected,
      refunded: t.refunded,
      net: t.net,
      expenses: t.expenses,
      netAfterExpenses,
      margin: t.net > 0 ? Math.round((netAfterExpenses / t.net) * 10000) / 100 : 0,
    },
    meta: { total: t.paymentCount, dateRange: { from: from.toISOString(), to: to.toISOString() }, basis: METRIC_BASIS },
  })
}
