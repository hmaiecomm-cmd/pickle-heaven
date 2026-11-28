'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Sparkles, TrendingUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChartKeyMember, MemberInsightsData, MemberInsightsRange } from './member-insights-types'
import { useMemberAiInsight } from './member-insights-ai'
import { MemberKpiCard } from './member-kpi-card'
import { MemberConversionFunnel } from './member-conversion-funnel'
import { MemberDailyActions } from './member-daily-actions'
import { MemberDemoDataSection, DemoAiInsightResult } from './member-demo-data'
import { MemberChartDetailed } from './member-chart-detailed'
import { CHART_SELECT_OPTIONS } from './member-chart-config'
import type { MemberAiInsightProvider } from './member-insights-ai'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

const demoDemoAiProvider: MemberAiInsightProvider = async () => DemoAiInsightResult

const RANGE_OPTIONS = [
  { key: '7', label: '近 7 天' },
  { key: '30', label: '近 30 天' },
  { key: '90', label: '近 90 天' },
  { key: '180', label: '近 180 天' },
  { key: 'custom', label: '自訂日期' },
]

export function MemberInsightsDashboard({
  data,
  initialChart = 'arpu',
  onRangeChange,
  isDemo = false,
}: {
  data: MemberInsightsData
  initialChart?: ChartKeyMember
  onRangeChange?: (range: MemberInsightsRange) => void
  isDemo?: boolean
}) {
  const router = useRouter()
  const [chart, setChart] = React.useState<ChartKeyMember>(initialChart)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customFrom, setCustomFrom] = React.useState(data.range.from)
  const [customTo, setCustomTo] = React.useState(data.range.to)
  const ai = useMemberAiInsight(isDemo ? demoDemoAiProvider : undefined)

  const handleRemoveDemo = () => {
    const params = new URLSearchParams()
    params.delete('demo')
    router.push(`/admin/reports?${params.toString()}`)
  }

  const handleRangeChange = (key: string) => {
    if (key === 'custom') {
      setCustomOpen(true)
    } else {
      const params = new URLSearchParams()
      params.set('range', key)
      router.push(`/admin/reports?${params.toString()}`)
    }
  }

  const handleCustomDateApply = () => {
    const params = new URLSearchParams()
    params.set('from', customFrom)
    params.set('to', customTo)
    router.push(`/admin/reports?${params.toString()}`)
    setCustomOpen(false)
  }

  if (!data.hasData) {
    return <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">尚無會員資料</div>
  }

  const runAi = () => {
    setAiOpen(true)
    void ai.run({ data, chart, focus: 'kpi' })
  }

  return (
    <div className="space-y-6">
      {/* ── DEMO 區塊 ── */}
      {isDemo && <MemberDemoDataSection />}

      {/* ── 標題與控制區 ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#1f2a22]">營收與會員成長洞察</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted truncate">
              {isDemo ? '📊 DEMO 示範資料｜' : ''}{data.range.from.replaceAll('-', '/')}～{data.range.to.replaceAll('-', '/')}（{data.range.days} 天）
            </p>
          </div>

          {/* 控制按鈕 */}
          <div className="flex items-center gap-2 flex-wrap justify-end sm:justify-start">
            <select
              value={data.range.key}
              onChange={(e) => handleRangeChange(e.target.value)}
              className="rounded-lg border border-[#d7dfcf] bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#3d4a40] hover:bg-[#f6f9f2] focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={runAi}
              disabled={ai.busy}
              className={cn('flex items-center gap-2 rounded-xl bg-[#2f7d3b] px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#276a32] disabled:opacity-70 whitespace-nowrap', focusRing)}
            >
              {ai.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline">AI 分析</span>
              <span className="sm:hidden">分析</span>
            </button>

            {isDemo && (
              <button
                type="button"
                onClick={handleRemoveDemo}
                className={cn('flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 whitespace-nowrap', focusRing)}
                title="移除 Demo"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">移除 Demo</span>
                <span className="sm:hidden">移除</span>
              </button>
            )}
          </div>
        </div>

        {/* 自訂日期選擇器 */}
        {customOpen && (
          <div className="mt-3 rounded-lg border border-[#d7dfcf] bg-[#f6f9f2] p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#3d4a40] mb-1">開始日期</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#d7dfcf] bg-white px-3 py-2 text-xs sm:text-sm text-[#3d4a40] focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3d4a40] mb-1">結束日期</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-[#d7dfcf] bg-white px-3 py-2 text-xs sm:text-sm text-[#3d4a40] focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="rounded-lg border border-[#d7dfcf] bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#3d4a40] hover:bg-[#f6f9f2]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCustomDateApply}
                className="rounded-lg bg-[#2f7d3b] px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#276a32]"
              >
                套用
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 六大 KPI 指標 ── */}
      <section aria-label="主要指標" className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-6">
        <MemberKpiCard icon={TrendingUp} label="會員營收" value={`NT$${data.kpi.memberRevenue.value.toLocaleString()}`} kpi={data.kpi.memberRevenue} />
        <MemberKpiCard icon={TrendingUp} label="ARPU" value={`NT$${data.kpi.arpu.value}`} kpi={data.kpi.arpu} />
        <MemberKpiCard icon={TrendingUp} label="留存率" value={`${data.kpi.retention.value}%`} kpi={data.kpi.retention} />
        <MemberKpiCard icon={TrendingUp} label="轉化率" value={`${data.kpi.conversion.value}%`} kpi={data.kpi.conversion} />
        <MemberKpiCard icon={TrendingUp} label="活躍會員" value={`${data.kpi.activeMembers.value}`} kpi={data.kpi.activeMembers} />
        <MemberKpiCard icon={TrendingUp} label="回訪率" value={`${data.kpi.retention30d.value}%`} kpi={data.kpi.retention30d} />
      </section>

      {/* ── 圖表選擇與詳細顯示 ── */}
      <div className="space-y-4">
        {/* 圖表選擇下拉菜單 */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className="text-sm font-semibold text-[#3d4a40] flex-shrink-0">選擇圖表：</label>
          <select
            value={chart}
            onChange={(e) => setChart(e.target.value as ChartKeyMember)}
            className="w-full sm:w-auto rounded-lg border border-[#d7dfcf] bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#3d4a40] hover:bg-[#f6f9f2] focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
          >
            {CHART_SELECT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 詳細圖表顯示 */}
        <MemberChartDetailed data={data} chartKey={chart} isDemo={isDemo} />
      </div>

      {/* ── 副區域：轉換漏斗 & 每日行動 ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e3e8dc] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#e3e8dc] px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="text-lg font-bold text-[#1f2a22]">會員轉換漏斗</h3>
            {isDemo && <span className="mt-1 inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">DEMO</span>}
          </div>
          <div className="p-4 sm:p-5">
            <MemberConversionFunnel steps={data.conversionFunnel} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3e8dc] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#e3e8dc] px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="text-lg font-bold text-[#1f2a22]">今日行動建議</h3>
            {isDemo && <span className="mt-1 inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">DEMO</span>}
          </div>
          <div className="p-4 sm:p-5">
            <MemberDailyActions actions={data.dailyActions} />
          </div>
        </div>
      </div>

      {/* ── AI 分析結果 ── */}
      <section className="rounded-2xl border border-[#e3e8dc] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          aria-expanded={aiOpen}
          aria-controls="ai-result"
          className={cn('flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 py-3 text-left', focusRing)}
        >
          <Sparkles className="h-5 w-5 text-[#2f7d3b] flex-shrink-0" aria-hidden />
          <span className="flex-1 text-base font-bold text-[#1f2a22]">AI 分析結果</span>
          <ChevronDown className={cn('h-5 w-5 text-muted transition-transform flex-shrink-0', aiOpen && 'rotate-180')} aria-hidden />
        </button>
        {aiOpen && (
          <div id="ai-result" className="border-t border-[#eef1e9] p-4 text-sm space-y-4" aria-live="polite">
            {ai.state.status === 'idle' && <div className="text-muted"><p className="font-semibold text-[#3d4a40]">尚未開始 AI 分析</p><p className="mt-1">按下頂部「AI 分析」按鈕開始</p></div>}
            {ai.state.status === 'loading' && (
              <div className="flex items-center gap-2 text-[#2f7d3b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI 分析中…</span>
              </div>
            )}
            {ai.state.status === 'error' && <div className="text-red-600"><p className="font-semibold">分析出錯</p><p className="mt-1">{ai.state.reason}</p></div>}
            {ai.state.status === 'success' && (
              <div className="space-y-4">
                {ai.state.result.findings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#1f2a22]">📊 關鍵發現</h4>
                    <ul className="mt-2 space-y-1 text-muted">
                      {ai.state.result.findings.map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ai.state.result.issues.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#1f2a22]">⚠️ 問題識別</h4>
                    <ul className="mt-2 space-y-1 text-muted">
                      {ai.state.result.issues.map((issue, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ai.state.result.actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#1f2a22]">✅ 建議行動</h4>
                    <ul className="mt-2 space-y-1 text-muted">
                      {ai.state.result.actions.map((action, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
