import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { formatDateTime } from '@/lib/time'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { activityStats, periodOf } from '../report-data'
import { PeriodTabs } from '../period-tabs'

export const metadata: Metadata = { title: '活動參與' }
export const dynamic = 'force-dynamic'

export default async function ActivityReportPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if ((await pagePermission('reports')) === 'forbidden') return <Forbidden />
  const p = periodOf((await searchParams).days)
  const rows = await activityStats(p)
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.fill, 0) / rows.length) : 0
  return (
    <div>
      <PageTitle title="活動參與" desc={`期間內 ${rows.length} 場，平均滿額率 ${avg}%`} />
      <PeriodTabs base="/admin/reports/activities" days={p.days} from={p.from} to={p.to} />
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-muted">
            <tr><th className="px-3 py-2 font-medium">場次</th><th className="px-3 py-2 font-medium">狀態</th><th className="px-3 py-2 text-right font-medium">報名／名額</th><th className="px-3 py-2 text-right font-medium">滿額率</th><th className="px-3 py-2 text-right font-medium">報到</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted">期間內沒有活動場次</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><Link href={`/admin/sessions/${r.id}`} className="hover:underline">{formatDateTime(r.startAt)} {r.title}</Link></td>
                <td className="px-3 py-2 text-xs">{r.status === 'CANCELLED' ? '已取消' : r.startAt > new Date() ? '未開始' : '已舉辦'}</td>
                <td className="px-3 py-2 text-right tabular">{r.confirmed}／{r.capacity}</td>
                <td className="px-3 py-2 text-right tabular">{r.fill}%</td>
                <td className="px-3 py-2 text-right tabular">{r.checkedIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceNote className="mt-3" source="活動場次與報名紀錄" basis="報名人數為已確認（含已出席、未到）佔用名額；不含購物車暫留" updatedAt={new Date()} />
    </div>
  )
}
