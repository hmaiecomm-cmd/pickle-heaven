'use client'

import * as React from 'react'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChartType, UtilizationData, AIInsight } from './types'
import { generateAIInsight } from './ai-service'
import { UtilizationKpiCard } from './utilization-kpi-card'
import { UtilizationChartsPanel } from './utilization-charts'
import { PricingRecommendations } from './pricing-recommendations'
import { ProductRecommendations } from './product-recommendations'
import { MarketingPlans } from './marketing-plans'
import { DemoSection } from './demo-section'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

interface UtilizationDashboardProps {
  data: UtilizationData
  initialChart?: ChartType
}

export function UtilizationDashboard({ data, initialChart = 'heatmap' }: UtilizationDashboardProps) {
  const [chart, setChart] = React.useState<ChartType>(initialChart)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiInsight, setAiInsight] = React.useState<AIInsight | null>(null)

  const runAi = async () => {
    setAiOpen(true)
    setAiLoading(true)
    try {
      const insight = await generateAIInsight(data)
      setAiInsight(insight)
    } finally {
      setAiLoading(false)
    }
  }

  if (!data.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">
        尚無場地使用率資料
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1f2a22]">空場率與收益優化</h1>
          <p className="mt-0.5 text-xs text-muted">
            {data.range.from.replaceAll('-', '/')}～{data.range.to.replaceAll('-', '/')}（{data.range.days} 天）
          </p>
        </div>
        <button
          type="button"
          onClick={runAi}
          disabled={aiLoading}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg bg-[#2f7d3b] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#276a32] disabled:opacity-70',
            focusRing,
          )}
        >
          {aiLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          )}
          {aiLoading ? '分析中' : 'AI 幫我優化'}
        </button>
      </div>

      <section aria-label="收益健康度" className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <UtilizationKpiCard label="整體場地使用率" value={data.kpi.overallRate.value} metric={data.kpi.overallRate} />
        <UtilizationKpiCard label="尖峰使用率" value={data.kpi.peakRate.value} metric={data.kpi.peakRate} />
        <UtilizationKpiCard label="離峰使用率" value={data.kpi.offPeakRate.value} metric={data.kpi.offPeakRate} />
        <UtilizationKpiCard label="離峰營收佔比" value={data.kpi.offPeakRevenueRatio.value} metric={data.kpi.offPeakRevenueRatio} />
        <UtilizationKpiCard label="每小時營收 RevPASH" value={`NT$${data.kpi.revpash.value}`} metric={data.kpi.revpash} />
        <UtilizationKpiCard label="空場損失預估" value={data.kpi.estimatedLoss.value} metric={data.kpi.estimatedLoss} />
        <UtilizationKpiCard label="優惠後實際營收" value={data.kpi.actualRevenue.value} metric={data.kpi.actualRevenue} />
        <UtilizationKpiCard label="場地附加收入" value={data.kpi.additionalIncome.value} metric={data.kpi.additionalIncome} />
      </section>

      <UtilizationChartsPanel data={data} activeChart={chart} onChartChange={setChart} />

      <section className="rounded-xl border border-[#e3e8dc] bg-white">
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          aria-expanded={aiOpen}
          aria-controls="ai-result"
          className={cn('flex min-h-9 w-full items-center gap-2 rounded-xl px-3 py-2 text-left', focusRing)}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-[#2f7d3b]" aria-hidden />
          <span className="flex-1 text-sm font-bold text-[#1f2a22]">AI 收益策略建議</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', aiOpen && 'rotate-180')} aria-hidden />
        </button>
        {aiOpen && (
          <div id="ai-result" className="border-t border-[#eef1e9] px-3 py-3 text-xs" aria-live="polite">
            {!aiInsight && !aiLoading && <p className="text-muted">按下「AI 幫我優化」按鈕開始分析</p>}
            {aiLoading && (
              <div className="flex items-center gap-2 text-[#2f7d3b]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>分析中…</span>
              </div>
            )}
            {aiInsight && (
              <div className="space-y-3">
                <div>
                  <p className="font-bold text-[#1f2a22]">📊 收益現況</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    {aiInsight.currentSituation.map((line, i) => (
                      <li key={i}>• {line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">🎯 最值得填補的空場</p>
                  <p className="mt-1 text-[#3d4a40]">{aiInsight.topOpportunity}</p>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">📈 尖峰定價建議</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    {aiInsight.peakPricing.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">🎁 離峰優惠建議</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    {aiInsight.offPeakRecommendation.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">📦 最適合的空場產品</p>
                  <p className="mt-1 text-[#3d4a40]">{aiInsight.bestProduct}</p>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">👥 目標客群</p>
                  <p className="mt-1 text-[#3d4a40]">{aiInsight.targetAudience}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2">
                  <p className="font-bold text-green-900">💰 預估營收影響</p>
                  <p className="mt-1 text-sm text-green-800">{aiInsight.estimatedImpact}</p>
                </div>
                <div>
                  <p className="font-bold text-[#1f2a22]">📋 建議追蹤指標</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    {aiInsight.trackingMetrics.map((metric, i) => (
                      <li key={i}>• {metric}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <PricingRecommendations />
      <ProductRecommendations products={data.productRecommendations} />
      <MarketingPlans plans={data.marketingPlans} />
      {data.demoMode && <DemoSection />}
    </div>
  )
}
