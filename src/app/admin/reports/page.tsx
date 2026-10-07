import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { overview, periodOf } from './report-data'
import { PeriodTabs } from './period-tabs'

export const metadata: Metadata = { title: '營運概況' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `NT$${n.toLocaleString()}`

export default async function ReportsOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const p = periodOf((await searchParams).days)
  const o = await overview(p)
  const cards = [
    { label: '訂單金額（下單，原價合計）', value: money(o.orderAmount), sub: `${o.orderCount} 筆，含未付款與已取消` },
    { label: '實收（付款成功）', value: money(o.collected), sub: `${o.paidCount} 筆，依付款時間` },
    { label: '退款（已完成，實付）', value: money(o.refunded), sub: `${o.refundCount} 筆，另退 ${o.refundedPoints} 點` },
    { label: '實收－退款', value: money(o.collected - o.refunded), sub: '不等於營收：未扣手續費與成本' },
    { label: '期間內打球的有效訂單', value: `${o.playedBookings} 筆`, sub: '依預約日期' },
    { label: '期間內取消', value: `${o.cancelled} 筆`, sub: '依取消時間' },
  ]
  return (
    <div>
      <PageTitle title="營運概況" desc="訂單金額、實收與退款分開計算，不混為營收。" />
      <PeriodTabs base="/admin/reports" days={p.days} from={p.from} to={p.to} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{c.value}</p>
            <p className="mt-1 text-[11px] text-muted">{c.sub}</p>
          </div>
        ))}
      </div>
      <SourceNote className="mt-3" source="訂單、付款與退款紀錄" basis="訂單金額依下單時間；實收依付款時間；退款依完成時間" updatedAt={new Date()} />
    </div>
  )
}
