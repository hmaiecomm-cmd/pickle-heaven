import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { periodOf } from '../report-data'
import { PeriodTabs } from '../period-tabs'
import { getUtilizationData } from './data'
import { UtilizationDashboard } from './utilization-dashboard'

export const metadata: Metadata = { title: '空場率與收益優化' }
export const dynamic = 'force-dynamic'

export default async function UtilizationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; chart?: string; demo?: string }>
}) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />

  const sp = await searchParams
  const period = periodOf(sp.days)
  const demoMode = sp.demo === '1'
  const data = await getUtilizationData(period, undefined, demoMode)
  const chart = (sp.chart ?? 'heatmap') as any

  return (
    <div className="space-y-6">
      <PageTitle
        title="空場率與收益優化"
        desc="找出空場機會，設計適合的價格與產品，讓每個時段都創造合理收益。"
      />
      <PeriodTabs base="/admin/reports/utilization" days={period.days} from={period.from} to={period.to} />

      {data.hasData ? (
        <>
          <UtilizationDashboard data={data} initialChart={chart} />
          <SourceNote
            source="預約、營收與會員紀錄"
            basis="使用率＝預約時段 ÷ 營業時段；RevPASH＝場地實收營收 ÷ 實際售出時數；空場損失＝可售時數 × 預估原價 − 實際營收"
            updatedAt={new Date()}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">
          <p>尚未建立場館或無足夠的預約資料。</p>
          <p className="mt-2 text-xs">建立至少 1 筆預約後，系統將自動計算空場率與收益分析。</p>
        </div>
      )}
    </div>
  )
}
