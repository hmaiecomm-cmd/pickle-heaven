import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { periodOf, utilization } from '../report-data'
import { PeriodTabs } from '../period-tabs'

export const metadata: Metadata = { title: '場地使用率' }
export const dynamic = 'force-dynamic'

export default async function UtilizationPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if ((await pagePermission('reports')) === 'forbidden') return <Forbidden />
  const p = periodOf((await searchParams).days)
  const u = await utilization(p)
  return (
    <div>
      <PageTitle title="場地使用率" desc="依預約與活動佔用的時段計算（不是現場感測）。" />
      <PeriodTabs base="/admin/reports/utilization" days={p.days} from={p.from} to={p.to} />
      {!u ? <p className="text-sm text-muted">尚未建立場館。</p> : (
        <div className="space-y-2">
          {u.courts.map((c) => (
            <div key={c.name} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="tabular">{c.rate}%</span>
              </div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${c.name} 使用率 ${c.rate}%`}>
                <span className="bg-brand-600" style={{ width: `${(c.booked / Math.max(1, c.total)) * 100}%` }} />
                <span className="bg-violet-300" style={{ width: `${(c.event / Math.max(1, c.total)) * 100}%` }} />
                <span className="bg-zinc-400" style={{ width: `${(c.blocked / Math.max(1, c.total)) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted">場地預約 {c.booked}・活動 {c.event}・封場 {c.blocked}／可用 {c.total} 個時段（每格 {u.slotMinutes} 分鐘）</p>
            </div>
          ))}
        </div>
      )}
      <SourceNote className="mt-3" source="場地佔用紀錄" basis="使用率＝（場地預約＋活動）時段 ÷ 營業時段；封場另列，不計入使用" updatedAt={new Date()} />
    </div>
  )
}
