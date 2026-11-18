import { pagePermission } from '@/lib/admin-auth'
import { PageTitle } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { periodOf, todayPeriod } from '@/app/admin/reports/report-data'
import { financeTotals, revenueByCourt, dailySeries } from '@/server/finance-metrics'
import { FinanceReportClient } from './finance-report-client'

export const metadata: Metadata = { title: '財務報表' }
export const dynamic = 'force-dynamic'

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pagePermission('finance')
  const sp = await searchParams
  const days = sp.days === '30' || sp.days === '90' ? Number(sp.days) : 7
  const period = periodOf(String(days))

  const [totals, courts, dailyData] = await Promise.all([
    financeTotals(period),
    revenueByCourt(period),
    dailySeries(period.from, period.to, period),
  ])

  return (
    <div className="space-y-6">
      <PageTitle title="財務報表" desc="場館收入與營運財務分析" />
      <FinanceReportClient
        totals={totals}
        courts={courts}
        dailyData={dailyData}
        period={period}
        selectedDays={days}
      />
    </div>
  )
}
