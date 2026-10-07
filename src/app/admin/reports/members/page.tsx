import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { memberStats, periodOf } from '../report-data'
import { PeriodTabs } from '../period-tabs'

export const metadata: Metadata = { title: '會員分析' }
export const dynamic = 'force-dynamic'

export default async function MemberReportPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if ((await pagePermission('reports')) === 'forbidden') return <Forbidden />
  const p = periodOf((await searchParams).days)
  const m = await memberStats(p)
  return (
    <div>
      <PageTitle title="會員分析" />
      <PeriodTabs base="/admin/reports/members" days={p.days} from={p.from} to={p.to} />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['會員總數', m.total],
          ['期間新加入', m.newMembers],
          ['期間有消費並打球', m.active],
          ['限制中的會員', m.restricted],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>
      <section className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">期間實收前 10 名</h2>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {m.top.length === 0 && <li className="py-2 text-muted">期間內沒有付款紀錄</li>}
          {m.top.map((t) => (
            <li key={t.userId} className="flex justify-between py-2">
              <Link href={`/admin/members/${t.userId}`} className="hover:underline">{t.name}</Link>
              <span className="tabular">NT${t.amount.toLocaleString()}・{t.count} 筆</span>
            </li>
          ))}
        </ul>
      </section>
      <SourceNote className="mt-3" source="會員與訂單紀錄" basis="實收依付款時間，未扣退款" updatedAt={new Date()} />
    </div>
  )
}
