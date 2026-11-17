import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Sparkles, TrendingUp, Users, AlertCircle, Zap } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { BarChart, ChartCard, HBarChart, LineChart, PieChart, StatCard } from '@/components/common'
import { METRIC_BASIS, dailySeries, incidentStats, revenueByCourt } from '@/server/finance-metrics'
import { AskAiButton } from '../overview-buttons'
import { overview, periodOf, todayPeriod, utilization } from './report-data'
import { PeriodTabs } from './period-tabs'

export const metadata: Metadata = { title: '營運總覽' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `NT$${n.toLocaleString()}`
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
    <div className="space-y-6">
      <PageTitle title="營運總覽" desc="即時監測場館營運狀態" />

      {/* KPI 卡片 - 今日概覽 */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="今日實收"
          value={money(today.totals.collected)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="現場使用場地"
          value={todayUtil?.courts.filter((c) => c.booked + c.event > 0).length ?? 0}
          unit="個"
          icon={<Zap className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="今日使用率"
          value={todayRate ?? '—'}
          unit={todayRate ? '%' : ''}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="成立訂單"
          value={today.totals.orders}
          unit="筆"
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="待處理異常"
          value={incidents.open}
          unit="件"
          icon={<AlertCircle className="h-5 w-5" />}
          color={incidents.open > 0 ? 'red' : 'green'}
        />
      </div>

      {/* 期間分析 */}
      <section aria-labelledby="period-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="period-title" className="text-sm font-semibold">
            {p.days} 天分析
          </h2>
          <PeriodTabs base="/admin/reports" days={p.days} from={p.from} to={p.to} />
        </div>

        {/* 財務 KPI */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="實收" value={money(totals.collected)} color="green" />
          <StatCard label="退款" value={money(totals.refunded)} color="orange" />
          <StatCard label="淨實收" value={money(totals.net)} color="green" />
          <StatCard label="成立訂單" value={`${totals.orders}`} unit="筆" color="blue" />
        </div>
      </section>

      {/* 趨勢與分析 */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="實收趨勢">
          <BarChart data={series.map((d) => ({ label: dateLabel(d.date, p.days), value: d.collected }))} />
        </ChartCard>
        <ChartCard title="訂單量">
          <LineChart data={series.map((d) => ({ label: dateLabel(d.date, p.days), value: d.orders }))} unit="筆" series="series-2" />
        </ChartCard>
      </div>

      {/* 場地與營收 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-2">
          <ChartCard title="場地排行">
            {courts.length ? (
              <HBarChart data={courts.map((c) => ({ label: c.court, value: c.amount }))} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">期間內沒有場地收益</p>
            )}
          </ChartCard>
        </div>
        <ChartCard title="營收構成">
          <PieChart
            data={[
              { label: '場地', value: totals.collected },
              { label: '退款', value: -totals.refunded },
            ].filter((d) => d.value > 0)}
          />
        </ChartCard>
      </div>

      {/* 異常與建議 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 異常統計 */}
        {incidents.byType.length > 0 && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">異常事件</h2>
            {incidents.byType.map((x) => (
              <div key={x.type} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
                <span className="text-xs font-medium text-red-700">{INCIDENT_LABEL[x.type] ?? x.type}</span>
                <span className="text-sm font-bold text-red-600">{x.count}</span>
              </div>
            ))}
            <Link href="/admin/incidents" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#2f7d3b] hover:underline">
              查看詳情 <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
            AI 建議
          </h2>
          <p className="mt-1.5 text-xs text-muted">根據實時營運數據分析</p>
          <div className="mt-3">
            <AskAiButton prompt={AI_PROMPT} />
          </div>
        </section>
      </div>

      {/* 更多分析 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">深度分析</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[
            ['/admin/finance', '💰 收入分析', '按場地、方式、明細'],
            ['/admin/reports/utilization', '📊 使用率', '各場地預約、活動'],
            ['/admin/reports/activities', '👥 活動參與', '場次、報名、出席'],
            ['/admin/reports/members', '⭐ 會員分析', '新會員、活躍、消費'],
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
