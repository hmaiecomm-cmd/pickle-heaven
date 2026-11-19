'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, AlertTriangle, CalendarCheck, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList, CreditCard, Gauge, Loader2, Package, RadioTower, Sparkles, Ticket, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHART_META, RANGE_LABEL, type ChartKey, type Kpi, type OverviewData, type RangeKey } from './overview-types'
import { chartRead, money, quickRead } from './overview-insights'
import { ChartPanel } from './overview-charts'
import { useAiInsight } from './ai-insight'
import { DemoAnalyticsSection } from './demo-analytics'

type Today = { bookings: number; activeCourts: number; rate: number | null; revenue: number; incidents: number }
type Incidents = { payment: number; notification: number; device: number; cancelled: number }

const PRESET_KEYS: RangeKey[] = ['7', '30', '90', '180']
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

export function OperationsDashboard({ data, today, incidents, warning, initialChart, todayDate }: { data: OverviewData | null; today: Today; incidents: Incidents; warning: string | null; initialChart: ChartKey; todayDate: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [chart, setChart] = React.useState<ChartKey>(initialChart)
  const [customOpen, setCustomOpen] = React.useState(data?.range.key === 'custom')
  const ai = useAiInsight()
  const [aiOpen, setAiOpen] = React.useState(true)

  // 期間改變後舊的 AI 結果就不適用了
  const rangeSig = data ? `${data.range.from}~${data.range.to}~${data.courtId ?? ''}` : ''
  const { reset } = ai
  React.useEffect(() => reset(), [rangeSig, reset])

  if (!data) return <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">尚無場館資料</div>

  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) v ? q.set(k, v) : q.delete(k)
    q.set('chart', chart)
    startTransition(() => router.push(`/admin/reports?${q.toString()}`, { scroll: false }))
  }
  const pickRange = (k: RangeKey) => {
    if (k === 'custom') return setCustomOpen(true)
    setCustomOpen(false)
    go({ range: k, from: null, to: null })
  }
  const pickChart = (c: ChartKey) => {
    setChart(c)
    const url = new URL(window.location.href)
    url.searchParams.set('chart', c)
    window.history.replaceState(null, '', url.toString())
  }
  const lines = quickRead(data)
  const runAi = () => {
    setAiOpen(true)
    void ai.run({ range: data.range, chart, kpi: data.kpi, chartSummary: chartRead(chart, data), quickRead: lines })
  }

  return (
    <div className={cn('space-y-5 transition-opacity', pending && 'opacity-60')} aria-busy={pending}>
      {/* ── 查看期間 ── */}
      <section aria-label="查看期間" className="rounded-2xl border border-[#e3e8dc] bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <span id="range-label" className="text-sm font-semibold text-[#3d4a40] md:mr-1">查看期間</span>

          <div role="group" aria-labelledby="range-label" className="hidden gap-1.5 xl:flex">
            {PRESET_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => pickRange(k)} aria-pressed={data.range.key === k} className={cn('h-11 rounded-xl px-3.5 text-sm font-semibold', focusRing, data.range.key === k ? 'bg-[#2f7d3b] text-white' : 'border border-[#d7dfcf] bg-white text-[#3d4a40] hover:bg-[#f6f9f2]')}>
                {RANGE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="relative xl:hidden">
            <select aria-labelledby="range-label" value={data.range.key === 'custom' ? 'custom' : data.range.key} onChange={(e) => pickRange(e.target.value as RangeKey)} className={cn('h-11 w-full appearance-none rounded-xl border border-[#d7dfcf] bg-white pl-3 pr-9 text-sm font-semibold md:w-40', focusRing)}>
              {PRESET_KEYS.map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
              <option value="custom">自訂日期</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>

          <button type="button" onClick={() => setCustomOpen(!customOpen)} aria-expanded={customOpen} aria-controls="custom-range" className={cn('flex h-11 items-center justify-between gap-1.5 rounded-xl border px-3.5 text-sm font-semibold md:justify-center', focusRing, data.range.key === 'custom' ? 'border-[#2f7d3b] bg-[#eef7e6] text-[#1f4d34]' : 'border-[#d7dfcf] bg-white text-[#3d4a40] hover:bg-[#f6f9f2]')}>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{data.range.key === 'custom' ? `${data.range.from.slice(5).replace('-', '/')}～${data.range.to.slice(5).replace('-', '/')}` : '自訂日期'}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', customOpen && 'rotate-180')} aria-hidden />
          </button>

          <button type="button" onClick={runAi} disabled={ai.busy} className={cn('flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2f7d3b] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#276a32] disabled:opacity-70 md:ml-auto md:w-auto', focusRing)}>
            {ai.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {ai.busy ? 'AI 判讀中' : 'AI 幫我判讀'}
          </button>
        </div>

        {customOpen && <CustomRange key={`${data.range.from}-${data.range.to}`} initialFrom={data.range.key === 'custom' ? data.range.from : ''} initialTo={data.range.key === 'custom' ? data.range.to : ''} max={todayDate} onApply={(from, to) => go({ range: 'custom', from, to })} />}

        <p className="mt-2 text-xs text-muted">
          {data.range.from.replaceAll('-', '/')}～{data.range.to.replaceAll('-', '/')}（{data.range.days} 天），與前期 {data.range.prevFrom.replaceAll('-', '/')}～{data.range.prevTo.replaceAll('-', '/')} 比較
          {pending && <span className="ml-2 inline-flex items-center gap-1 font-semibold text-[#2f7d3b]"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />更新中…</span>}
        </p>
        {warning && <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">{warning}</p>}
      </section>

      {/* ── KPI ── */}
      <section aria-label="主要指標" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CalendarDays} label="使用率" value={`${data.kpi.utilization.value}%`} kpi={data.kpi.utilization} unit="pt" />
        <KpiCard icon={CircleDollarSign} label="營收" value={money(data.kpi.revenue.value)} kpi={data.kpi.revenue} />
        <KpiCard icon={ClipboardList} label="訂單數" value={data.kpi.orders.value.toLocaleString()} kpi={data.kpi.orders} />
        <KpiCard icon={UsersRound} label="會員數" value={data.kpi.members.value.toLocaleString()} kpi={data.kpi.members} />
      </section>

      {/* ── 快速判讀 ── */}
      <section aria-labelledby="quick-read" className="flex flex-col gap-3 rounded-2xl bg-[#eef7e6] p-4 ring-1 ring-[#d4e8c4] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <h2 id="quick-read" className="flex shrink-0 items-center gap-2 text-lg font-bold text-[#1f4d34] sm:border-r sm:border-[#c9e0b6] sm:pr-5">
          <BarIcon />快速判讀
        </h2>
        {lines.length ? (
          <ul className="space-y-1 text-sm text-[#2c3a2e]">{lines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f7d3b]" />{l}</li>)}</ul>
        ) : (
          <p className="text-sm text-[#2c3a2e]">目前資料不足，暫時無法判讀</p>
        )}
      </section>

      {/* ── 圖表（一次只顯示一個） ── */}
      <ChartPanel
        data={data}
        chart={chart}
        onChart={pickChart}
        idPrefix="real"
        extra={(chart === 'usage' || chart === 'heatmap') && data.courtOptions.length > 1 ? (
          <div className="relative">
            <select aria-label="球場" value={data.courtId ?? ''} onChange={(e) => go({ court: e.target.value || null })} className={cn('h-11 w-full appearance-none rounded-xl border border-[#d7dfcf] bg-white pl-3 pr-9 text-sm sm:w-32', focusRing)}>
              <option value="">全部球場</option>
              {data.courtOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>
        ) : undefined}
      />

      {/* DEMO｜示範資料：整段可移除（見 demo-analytics.tsx） */}
      <DemoAnalyticsSection />

      {/* ── AI 判讀結果 ── */}
      <section className="rounded-2xl border border-[#e3e8dc] bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
        <button type="button" onClick={() => setAiOpen(!aiOpen)} aria-expanded={aiOpen} aria-controls="ai-result" className={cn('flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left', focusRing)}>
          <Sparkles className="h-5 w-5 text-[#2f7d3b]" aria-hidden />
          <span className="flex-1 text-base font-bold text-[#1f2a22]">AI 判讀結果</span>
          <ChevronDown className={cn('h-5 w-5 text-muted transition-transform', aiOpen && 'rotate-180')} aria-hidden />
        </button>
        {aiOpen && (
          <div id="ai-result" className="border-t border-[#eef1e9] p-4 text-sm" aria-live="polite">
            {ai.state.status === 'idle' && (
              <div className="text-muted"><p className="font-semibold text-[#3d4a40]">尚未開始 AI 判讀</p><p className="mt-1">選擇期間後按下「AI 幫我判讀」</p></div>
            )}
            {ai.state.status === 'loading' && (
              <div className="flex items-start gap-2"><Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[#2f7d3b]" aria-hidden /><div><p className="font-semibold">AI 正在判讀中</p><p className="text-muted">請稍候，約需幾秒鐘</p></div></div>
            )}
            {ai.state.status === 'error' && (
              <div className="rounded-xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200" role="alert">
                <p className="font-semibold">AI 判讀失敗，請稍後再試</p>
                <p className="mt-1 text-xs">原因：{ai.state.reason}</p>
              </div>
            )}
            {ai.state.status === 'success' && (
              <div className="space-y-3">
                <p className="text-xs text-muted">分析範圍：{RANGE_LABEL[ai.state.request.range.key]}（{ai.state.request.range.from}～{ai.state.request.range.to}）・{CHART_META[ai.state.request.chart].title}</p>
                {([['關鍵發現', ai.state.result.findings, 'text-[#1f4d34]'], ['可能的問題', ai.state.result.issues, 'text-amber-800'], ['建議行動', ai.state.result.actions, 'text-sky-800']] as const).map(([title, items, tone]) => (
                  <div key={title}>
                    <h3 className={cn('font-bold', tone)}>{title}</h3>
                    {items.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-1 text-muted">—</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 今日即時狀態與異常（保留原有內容） ── */}
      <section aria-label="今日即時狀態" className="rounded-2xl border border-[#e3e8dc] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#1f2a22]">今日即時狀態</h2>
          <Link href="/admin/incidents" className={cn('inline-flex min-h-11 items-center text-xs font-semibold text-brand-700 hover:underline', focusRing)}>查看全部異常 →</Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MiniStat icon={CalendarCheck} label="今日預約" value={`${today.bookings} 筆`} />
          <MiniStat icon={Activity} label="目前使用場地" value={`${today.activeCourts} 面`} />
          <MiniStat icon={Gauge} label="今日使用率" value={today.rate === null ? '—' : `${today.rate}%`} />
          <MiniStat icon={CircleDollarSign} label="今日營收" value={money(today.revenue)} />
          <MiniStat icon={AlertTriangle} label="未處理異常" value={`${today.incidents} 件`} tone={today.incidents ? 'red' : 'green'} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MiniStat icon={CreditCard} label="付款異常" value={String(incidents.payment)} tone={incidents.payment ? 'red' : 'gray'} />
          <MiniStat icon={RadioTower} label="通知失敗" value={String(incidents.notification)} tone={incidents.notification ? 'amber' : 'gray'} />
          <MiniStat icon={Package} label="設備異常" value={String(incidents.device)} tone={incidents.device ? 'amber' : 'gray'} />
          <MiniStat icon={Ticket} label="今日取消" value={String(incidents.cancelled)} tone="gray" />
        </div>
      </section>
    </div>
  )
}

function BarIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><rect x="3" y="12" width="4" height="9" rx="1" fill="#2f7d3b" /><rect x="10" y="7" width="4" height="14" rx="1" fill="#2f7d3b" /><rect x="17" y="3" width="4" height="18" rx="1" fill="#2f7d3b" /></svg>
}

function KpiCard({ icon: Icon, label, value, kpi, unit = '%' }: { icon: typeof Gauge; label: string; value: string; kpi: Kpi; unit?: '%' | 'pt' }) {
  const c = kpi.change
  const up = c !== null && c > 0
  const down = c !== null && c < 0
  return (
    <div className="min-w-0 rounded-2xl border border-[#e3e8dc] bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#3d4a40]"><Icon className="h-5 w-5 shrink-0 text-[#1f4d34]" strokeWidth={1.8} aria-hidden />{label}</p>
      <p className="mt-2 truncate text-2xl font-bold tabular text-[#1f2a22] sm:text-[28px]">{value}</p>
      <p className={cn('mt-1 text-xs font-semibold', up ? 'text-emerald-700' : down ? 'text-red-700' : 'text-muted')}>
        {c === null ? '前期無資料可比較' : `${up ? '▲ 上升' : down ? '▼ 下降' : '― 持平'} ${c > 0 ? '+' : ''}${c}${unit === 'pt' ? ' 個百分點' : '%'}`}
        {c !== null && <span className="ml-1 font-normal text-muted">較前期</span>}
      </p>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, tone = 'green' }: { icon: typeof Gauge; label: string; value: string; tone?: 'green' | 'red' | 'amber' | 'gray' }) {
  const cls = { green: 'bg-emerald-50 text-emerald-800', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', gray: 'bg-zinc-50 text-zinc-700' }[tone]
  return (
    <div className={cn('rounded-xl p-2.5', cls)}>
      <p className="flex items-center gap-1.5 text-[11px] opacity-90"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</p>
      <p className="mt-0.5 text-base font-bold tabular">{value}</p>
    </div>
  )
}

function CustomRange({ initialFrom, initialTo, max, onApply }: { initialFrom: string; initialTo: string; max: string; onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = React.useState(initialFrom)
  const [to, setTo] = React.useState(initialTo)
  const [error, setError] = React.useState<string | null>(null)
  const apply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return setError('請選擇開始日期與結束日期')
    if (from > to) return setError('結束日期不可早於開始日期')
    if (to > max) return setError('結束日期不可晚於今天')
    setError(null)
    onApply(from, to)
  }
  const field = cn('h-11 w-full min-w-0 rounded-xl border border-[#d7dfcf] bg-white px-3 text-sm', focusRing)
  return (
    <form id="custom-range" onSubmit={apply} className="mt-3 grid gap-2 rounded-xl bg-[#f6f9f2] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <label className="block min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#3d4a40]">開始日期</span>
        <input type="date" value={from} max={to || max} onChange={(e) => setFrom(e.target.value)} className={field} aria-invalid={!!error && !from} />
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#3d4a40]">結束日期</span>
        <input type="date" value={to} min={from || undefined} max={max} onChange={(e) => setTo(e.target.value)} className={field} aria-invalid={!!error && !to} />
      </label>
      <button type="submit" className={cn('h-11 rounded-xl bg-[#1f4d34] px-5 text-sm font-semibold text-white', focusRing)}>套用日期</button>
      {error && <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-3">{error}</p>}
    </form>
  )
}
