'use client'

import * as React from 'react'
import { ChevronDown, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChartKeyMember, MemberInsightsData, MemberInsightsRange } from './member-insights-types'
import { useMemberAiInsight } from './member-insights-ai'
import { MemberKpiCard } from './member-kpi-card'
import { MemberConversionFunnel } from './member-conversion-funnel'
import { MemberChartsPanel } from './member-charts'
import { MemberDailyActions } from './member-daily-actions'
import { MemberDemoDataSection, DemoAiInsightResult } from './member-demo-data'
import type { MemberAiInsightProvider } from './member-insights-ai'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

const demoDemoAiProvider: MemberAiInsightProvider = async () => DemoAiInsightResult

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
  const [chart, setChart] = React.useState<ChartKeyMember>(initialChart)
  const [aiOpen, setAiOpen] = React.useState(false)
  const ai = useMemberAiInsight(isDemo ? demoDemoAiProvider : undefined)

  if (!data.hasData) {
    return <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">尚無會員資料</div>
  }

  const runAi = () => {
    setAiOpen(true)
    void ai.run({ data, chart, focus: 'kpi' })
  }

  return (
    <div className="space-y-5">
      {/* ── DEMO 區塊 ── */}
      {isDemo && <MemberDemoDataSection />}

      {/* ── 標題與 AI 按鈕 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1f2a22]">營收與會員成長洞察</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {isDemo ? '📊 DEMO 示範資料｜' : ''}{data.range.from.replaceAll('-', '/')}～{data.range.to.replaceAll('-', '/')}（{data.range.days} 天），與前期比較
          </p>
        </div>
        <button
          type="button"
          onClick={runAi}
          disabled={ai.busy}
          className={cn('flex items-center gap-2 rounded-xl bg-[#2f7d3b] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#276a32] disabled:opacity-70 self-start sm:self-auto', focusRing)}
        >
          {ai.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {ai.busy ? 'AI 分析中' : 'AI 分析'}
        </button>
      </div>

      {/* ── 四大北極星 KPI ── */}
      <section aria-label="主要指標" className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
        <MemberKpiCard icon={TrendingUp} label="會員營收" value={`¥${data.kpi.memberRevenue.value.toLocaleString()}`} kpi={data.kpi.memberRevenue} />
        <MemberKpiCard icon={TrendingUp} label="ARPU" value={`¥${data.kpi.arpu.value}`} kpi={data.kpi.arpu} />
        <MemberKpiCard icon={TrendingUp} label="留存率" value={`${data.kpi.retention.value}%`} kpi={data.kpi.retention} />
        <MemberKpiCard icon={TrendingUp} label="轉化率" value={`${data.kpi.conversion.value}%`} kpi={data.kpi.conversion} />
      </section>

      {/* ── 圖表與分析（主要優先） ── */}
      <MemberChartsPanel data={data} activeChart={chart} onChart={setChart} />

      {/* ── 會員轉換漏斗與每日行動（兩欄或單欄） ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <MemberConversionFunnel steps={data.conversionFunnel} />
        <MemberDailyActions actions={data.dailyActions} />
      </div>

      {/* ── AI 分析結果 ── */}
      <section className="rounded-2xl border border-[#e3e8dc] bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          aria-expanded={aiOpen}
          aria-controls="ai-result"
          className={cn('flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left', focusRing)}
        >
          <Sparkles className="h-5 w-5 text-[#2f7d3b]" aria-hidden />
          <span className="flex-1 text-base font-bold text-[#1f2a22]">AI 分析結果</span>
          <ChevronDown className={cn('h-5 w-5 text-muted transition-transform', aiOpen && 'rotate-180')} aria-hidden />
        </button>
        {aiOpen && (
          <div id="ai-result" className="border-t border-[#eef1e9] p-4 text-sm" aria-live="polite">
            {ai.state.status === 'idle' && <div className="text-muted"><p className="font-semibold text-[#3d4a40]">尚未開始 AI 分析</p><p className="mt-1">按下「AI 分析」按鈕開始</p></div>}
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
                          <span>•</span>
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
                      {ai.state.result.issues.map((i, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span>•</span>
                          <span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ai.state.result.actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#1f2a22]">✅ 建議行動</h4>
                    <ul className="mt-2 space-y-1 text-muted">
                      {ai.state.result.actions.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span>•</span>
                          <span>{a}</span>
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
