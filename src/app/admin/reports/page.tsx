import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { BarChart, ChartCard, HBarChart, LineChart } from '@/components/common'
import { METRIC_BASIS, dailySeries, incidentStats, revenueByCourt } from '@/server/finance-metrics'
import { AskAiButton } from '../overview-buttons'
import { overview, periodOf, todayPeriod, utilization } from './report-data'
import { PeriodTabs } from './period-tabs'

export const metadata: Metadata = { title: '營運總覽' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `NT$${n.toLocaleString()}`
/** 14 天以內顯示「月/日」，更長的期間只顯示日，避免標籤擠在一起 */
const dateLabel = (d: string, days: number) => (days <= 14 ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : String(Number(d.slice(8, 10))))

const INCIDENT_LABEL: Record<string, string> = {
  CAMERA: '攝影機異常',
  DEVICE_OFFLINE: '設備離線',
  DEVICE_STALE: '設備資料逾時',
  OCCUPANCY_CONFLICT: '場地占用與預約不符',
  PAYMENT_AFTER_EXPIRY: '逾時後付款',
  PAYMENT_FAILED: '付款失敗',
  REFUND_FAILED: '退款失敗',
  REFUND_MANUAL: '需人工退款',
}

const AI_PROMPT = '請根據目前的營運總覽數據（實收、退款、訂單趨勢、場地使用率、各場地收益、異常事件），給我三項具體、可執行的營運建議，並說明依據的數字。'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </div>
  )
}

export default async function ReportsOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const p = periodOf((await searchParams).days)
  const t = todayPeriod()

  const [o, today, todayUtil, series, courts, incidents] = await Promise.all([
    overview(p),
    overview(t),
    utilization(t),
    dailySeries(p.from, p.to, p),
    revenueByCourt(p),
    incidentStats(p),
  ])
  const todayRate = todayUtil && todayUtil.courts.length ? Math.round(todayUtil.courts.reduce((s, c) => s + c.rate, 0) / todayUtil.courts.length) : null
  const totals = o.totals

  return (
    <div className="space-y-5">
      <PageTitle title="營運總覽" desc="分析用。所有金額與訂單數都和「訂單與財務」使用同一套算法。" />

      <section aria-labelledby="today-title">
        <h2 id="today-title" className="mb-2 text-sm font-semibold">
          今天（{t.from}）
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="今日實收" value={money(today.totals.collected)} sub={`淨實收 ${money(today.totals.net)}`} />
          <Stat label="今日成立訂單" value={`${today.totals.orders} 筆`} sub="付款成功的訂單" />
          <Stat label="今日場地使用率" value={todayRate === null ? '—' : `${todayRate}%`} sub="已預約＋活動時段 ÷ 營業時段" />
          <Stat label="待處理異常" value={`${incidents.open} 件`} sub="尚未結案的異常事件" />
        </div>
      </section>

      <section aria-labelledby="period-title" className="space-y-3">
        <h2 id="period-title" className="sr-only">
          期間指標
        </h2>
        <PeriodTabs base="/admin/reports" days={p.days} from={p.from} to={p.to} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="實收" value={money(totals.collected)} sub={`${totals.paymentCount} 筆付款・${METRIC_BASIS.collected}`} />
          <Stat label="退款（現金）" value={money(totals.refunded)} sub={`${totals.refundCount} 筆，另退 ${totals.refundedPoints} 點`} />
          <Stat label="淨實收" value={money(totals.net)} sub={METRIC_BASIS.net} />
          <Stat label="成立訂單" value={`${totals.orders} 筆`} sub={`期間內取消 ${o.cancelled} 筆`} />
          <Stat label="儲值實收" value={money(totals.topup)} sub={`${totals.topupCount} 筆，另列不併入實收`} />
          <Stat label="核准費用" value={money(totals.expenses)} sub={METRIC_BASIS.expenses} />
          <Stat label="下單金額（原價）" value={money(o.orderAmount)} sub={`${o.orderCount} 筆，含未付款與已取消`} />
          <Stat label="期間內打球的有效訂單" value={`${o.playedBookings} 筆`} sub="依預約日期" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="實收趨勢" subtitle="逐日，依付款時間">
          <BarChart data={series.map((d) => ({ label: dateLabel(d.date, p.days), value: d.collected }))} />
        </ChartCard>
        <ChartCard title="退款趨勢" subtitle="逐日現金退款，依完成時間">
          <BarChart data={series.map((d) => ({ label: dateLabel(d.date, p.days), value: d.refunded }))} series="series-2" />
        </ChartCard>
        <ChartCard title="訂單趨勢" subtitle="逐日成立訂單數">
          <LineChart data={series.map((d) => ({ label: dateLabel(d.date, p.days), value: d.orders }))} unit="筆" />
        </ChartCard>
        <ChartCard title="各場地收益" subtitle="期間實收按場地／活動明細分攤，加總等於實收">
          {courts.length ? (
            <HBarChart data={courts.map((c) => ({ label: c.slots ? `${c.court}（${c.slots} 時段）` : c.court, value: c.amount }))} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">期間內沒有場地收益</p>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">設備與場地異常統計</h2>
          <p className="mt-0.5 text-[11px] text-muted">期間內新增的異常事件；電力與門禁硬體串接後會一併列入</p>
          {incidents.byType.length ? (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {incidents.byType.map((x) => (
                <li key={x.type} className="flex justify-between py-2">
                  <span>{INCIDENT_LABEL[x.type] ?? x.type}</span>
                  <span className="tabular">{x.count} 件</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">期間內沒有異常事件</p>
          )}
          <Link href="/admin/incidents" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#2f7d3b] hover:underline">
            查看異常警示與處理紀錄 <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
            AI 營運建議
          </h2>
          <p className="mt-1 text-sm text-zinc-700">由小P 讀取目前的營運數據即時分析，提出可執行的建議並列出依據的數字。建議僅供參考，不會自動執行任何操作。</p>
          <div className="mt-3">
            <AskAiButton prompt={AI_PROMPT} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">更多分析</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['/admin/finance', '收入與退款分析', '依球場、付款方式、費用與明細'],
            ['/admin/reports/utilization', '場地使用率', '各場地預約、活動、封場時段'],
            ['/admin/reports/activities', '活動參與', '場次、報名與出席'],
            ['/admin/reports/members', '會員分析', '新會員、活躍會員與消費排行'],
          ].map(([href, title, desc]) => (
            <Link key={href} href={href} className="rounded-xl border border-zinc-200 px-3 py-2.5 hover:border-[#7cb342] hover:bg-[#f6faf2]">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-[11px] text-muted">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <SourceNote source="付款、退款、訂單、儲值、費用、異常事件紀錄" basis="實收依付款時間；退款依完成時間；費用依申請時間（Asia/Taipei）" updatedAt={new Date()} />
    </div>
  )
}
