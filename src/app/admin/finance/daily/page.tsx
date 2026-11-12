import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { addDays, formatDateTime, isValidDateString, taipeiDateString } from '@/lib/time'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'
import { METRIC_BASIS } from '@/server/finance-metrics'
import { dailyClose, reconcileIssues } from '@/server/finance-reconcile'

export const metadata: Metadata = { title: '日結與對帳' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `NT$${n.toLocaleString()}`

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{sub}</p>
    </div>
  )
}

export default async function DailyClosePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const today = taipeiDateString()
  const raw = (await searchParams).date
  const date = raw && isValidDateString(raw) && raw <= today ? raw : today
  const [day, issues] = await Promise.all([dailyClose(date), reconcileIssues()])
  const t = day.totals
  const openCount = issues.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="space-y-5">
      <PageTitle title="日結與對帳" desc="每日收款結算，以及需要處理的帳務差異。金額與營運總覽使用同一套算法。" />

      <section aria-labelledby="close-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="close-title" className="mr-2 text-sm font-semibold">
            日結
          </h2>
          <Link href={`?date=${addDays(date, -1)}`} className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-zinc-200 hover:bg-zinc-50" aria-label="前一天">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <form className="flex items-center gap-2">
            <input type="date" name="date" defaultValue={date} max={today} aria-label="日結日期" className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-sm" />
            <button type="submit" className="h-8 rounded-lg bg-[#1f4d34] px-3 text-sm font-medium text-white">
              查看
            </button>
          </form>
          {date < today && (
            <Link href={`?date=${addDays(date, 1)}`} className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-zinc-200 hover:bg-zinc-50" aria-label="後一天">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
          {date !== today && (
            <Link href="?" className="text-xs text-[#2f7d3b] hover:underline">
              回到今天
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="訂場與活動實收" value={money(t.collected)} sub={`${t.paymentCount} 筆付款`} />
          <Stat label="現金退款" value={money(t.refunded)} sub={`${t.refundCount} 筆，另退 ${t.refundedPoints} 點`} />
          <Stat label="淨實收" value={money(t.net)} sub={METRIC_BASIS.net} />
          <Stat label="儲值實收" value={money(t.topup)} sub={`${t.topupCount} 筆，另列`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">依收款管道</h3>
            {day.byChannel.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">管道／方式</th>
                    <th className="px-4 py-2 text-right font-medium">筆數</th>
                    <th className="px-4 py-2 text-right font-medium">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {day.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td className="px-4 py-2">{c.channel}</td>
                      <td className="px-4 py-2 text-right tabular">{c.count}</td>
                      <td className="px-4 py-2 text-right tabular">{money(c.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-4 py-2">合計</td>
                    <td className="px-4 py-2 text-right tabular">{t.paymentCount}</td>
                    <td className="px-4 py-2 text-right tabular">{money(t.collected)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted">這天沒有收款</p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">當日明細</h3>
            {day.payments.length + day.refunds.length + day.topups.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">這天沒有收款、退款或儲值</p>
            ) : (
              <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto text-sm">
                {day.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 truncate">
                      <Pill tone="green">收款</Pill> {p.booking.code}・{p.provider}
                    </span>
                    <span className="shrink-0 tabular">
                      {money(p.amount)} <span className="text-[11px] text-muted">{p.paidAt ? formatDateTime(p.paidAt).slice(-5) : ''}</span>
                    </span>
                  </li>
                ))}
                {day.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 truncate">
                      <Pill tone="red">退款</Pill> {r.booking.code}・{r.method}
                    </span>
                    <span className="shrink-0 tabular">−{money(r.cashAmount)}</span>
                  </li>
                ))}
                {day.topups.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 truncate">
                      <Pill tone="blue">儲值</Pill> {x.points} 點・{x.provider ?? '—'}
                    </span>
                    <span className="shrink-0 tabular">{money(x.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      <section aria-labelledby="reconcile-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 id="reconcile-title" className="text-sm font-semibold">
            對帳：待處理項目
          </h2>
          {openCount ? <Pill tone="amber">{openCount} 筆</Pill> : <Pill tone="green">全部結清</Pill>}
          <span className="text-[11px] text-muted">不限日期，處理完畢後會自動從清單消失</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {issues.map((g) => (
            <section key={g.key} className="rounded-2xl border border-zinc-200 bg-white">
              <div className="flex items-start gap-2 border-b border-zinc-100 px-4 py-3">
                {g.items.length ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">
                    {g.title}（{g.items.length}）
                  </h3>
                  <p className="text-[11px] text-muted">{g.hint}</p>
                </div>
              </div>
              {g.items.length ? (
                <ul className="divide-y divide-zinc-100 text-sm">
                  {g.items.map((it, i) => (
                    <li key={`${it.bookingId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2">
                      <Link href={`/admin/bookings?q=${encodeURIComponent(it.code)}`} className="font-medium text-[#2f7d3b] hover:underline">
                        {it.code}
                      </Link>
                      <span className="text-xs text-muted">
                        {it.detail}・應付 {money(it.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-xs text-muted">沒有待處理項目</p>
              )}
            </section>
          ))}
        </div>
      </section>

      <SourceNote source="付款、退款、儲值與訂單紀錄" basis="收款依付款時間、退款依完成時間（Asia/Taipei）" updatedAt={new Date()} />
    </div>
  )
}
