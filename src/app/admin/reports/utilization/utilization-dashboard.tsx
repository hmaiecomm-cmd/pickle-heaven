'use client'

import * as React from 'react'
import { ChevronDown, Loader2, Sparkles, Calendar } from 'lucide-react'
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

interface UtilizationDashboardInterfaceProps extends UtilizationDashboardProps {
  defaultDays?: number
  defaultCourtId?: string
  onDaysChange?: (days: number) => void
  onCourtChange?: (courtId: string) => void
}

export function UtilizationDashboard({
  data,
  initialChart = 'heatmap',
  defaultDays = 30,
  defaultCourtId = '',
  onDaysChange,
  onCourtChange
}: UtilizationDashboardInterfaceProps) {
  const [chart, setChart] = React.useState<ChartType>(initialChart)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiInsight, setAiInsight] = React.useState<AIInsight | null>(null)
  const [periodMode, setPeriodMode] = React.useState<'7' | '30' | '90' | '180' | 'custom'>('30')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [selectedCourtId, setSelectedCourtId] = React.useState<string>(defaultCourtId)
  const [showDemo, setShowDemo] = React.useState(data.demoMode)

  const handlePeriodChange = (mode: '7' | '30' | '90' | '180' | 'custom') => {
    setPeriodMode(mode)
  }

  const handleCourtChange = (courtId: string) => {
    setSelectedCourtId(courtId)
    onCourtChange?.(courtId)
  }

  const handleApplyCustomDate = () => {
    if (customStartDate && customEndDate) {
      // Custom date logic - in real implementation would fetch data for this range
      console.log(`Apply custom date: ${customStartDate} to ${customEndDate}`)
    }
  }

  const handleClearCustomDate = () => {
    setCustomStartDate('')
    setCustomEndDate('')
    setPeriodMode('30')
  }

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
      {/* 頁面標題 */}
      <div>
        <h1 className="text-xl font-bold text-[#1f2a22]">空場率與收益優化</h1>
        <p className="mt-0.5 text-xs text-muted">
          {periodMode === 'custom'
            ? `${customStartDate}～${customEndDate}（自訂期間）`
            : `${data.range.from.replaceAll('-', '/')}～${data.range.to.replaceAll('-', '/')}（${data.range.days} 天）`}
        </p>
      </div>

      {/* 控制列 */}
      <div className="space-y-3">
        {/* 主控制列 */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="flex flex-col gap-1 flex-1 sm:flex-initial min-w-[160px]">
            <label className="text-xs font-semibold text-[#1f2a22]">分析期間</label>
            <select
              value={periodMode}
              onChange={(e) => handlePeriodChange(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
            >
              <option value="7">近 7 天</option>
              <option value="30">近 30 天</option>
              <option value="90">近 90 天</option>
              <option value="180">近 180 天</option>
              <option value="custom">自訂日期</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 sm:flex-initial min-w-[160px]">
            <label className="text-xs font-semibold text-[#1f2a22]">場地</label>
            <select
              value={selectedCourtId}
              onChange={(e) => handleCourtChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
            >
              <option value="">全部場地</option>
              {data.courts.map(court => (
                <option key={court.id} value={court.id}>{court.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={runAi}
            disabled={aiLoading}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg bg-[#2f7d3b] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#276a32] disabled:opacity-70 h-10',
              focusRing,
            )}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {aiLoading ? '分析中' : 'AI 幫我優化'}
          </button>
        </div>

        {/* 自訂日期欄位 - 只在選擇自訂日期時顯示 */}
        {periodMode === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-[#1f2a22]">開始日期</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-[#1f2a22]">結束日期</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
              />
            </div>

            <div className="flex gap-2 sm:items-end">
              <button
                type="button"
                onClick={handleApplyCustomDate}
                disabled={!customStartDate || !customEndDate}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
                  focusRing,
                )}
              >
                套用
              </button>
              <button
                type="button"
                onClick={handleClearCustomDate}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-[#1f2a22] hover:bg-zinc-50',
                  focusRing,
                )}
              >
                清除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI 卡片 - 響應式布局 */}
      <section aria-label="收益健康度" className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        <UtilizationKpiCard label="整體場地使用率" value={data.kpi.overallRate.value} metric={data.kpi.overallRate} />
        <UtilizationKpiCard label="尖峰使用率" value={data.kpi.peakRate.value} metric={data.kpi.peakRate} />
        <UtilizationKpiCard label="離峰使用率" value={data.kpi.offPeakRate.value} metric={data.kpi.offPeakRate} />
        <UtilizationKpiCard label="離峰營收佔比" value={data.kpi.offPeakRevenueRatio.value} metric={data.kpi.offPeakRevenueRatio} />
        <UtilizationKpiCard label="每小時營收 RevPASH" value={`NT$${data.kpi.revpash.value}`} metric={data.kpi.revpash} />
        <UtilizationKpiCard label="空場損失預估" value={data.kpi.estimatedLoss.value} metric={data.kpi.estimatedLoss} />
        <UtilizationKpiCard label="優惠後實際營收" value={data.kpi.actualRevenue.value} metric={data.kpi.actualRevenue} />
        <UtilizationKpiCard label="場地附加收入" value={data.kpi.additionalIncome.value} metric={data.kpi.additionalIncome} />
      </section>

      <UtilizationChartsPanel data={data} activeChart={chart} onChartChange={setChart} selectedCourtId={selectedCourtId} />

      {/* 場地營運狀態 - 響應式 3 欄或 2 欄 */}
      <section aria-label="場地營運狀態" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <h3 className="font-semibold text-[#1f2a22] text-sm">營運中</h3>
          </div>
          <p className="text-2xl font-bold text-green-700">{data.courts.length}</p>
          <p className="text-xs text-green-600 mt-1">個場地</p>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
            <h3 className="font-semibold text-[#1f2a22] text-sm">維護中</h3>
          </div>
          <p className="text-2xl font-bold text-amber-700">0</p>
          <p className="text-xs text-amber-600 mt-1">個場地</p>
        </div>

        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-orange-600"></div>
            <h3 className="font-semibold text-[#1f2a22] text-sm">低使用率</h3>
          </div>
          <p className="text-2xl font-bold text-orange-700">0</p>
          <p className="text-xs text-orange-600 mt-1">個場地</p>
        </div>
      </section>

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
      <MarketingPlans
        plans={data.marketingPlans}
        demoMode={showDemo}
        onRemoveDemo={() => setShowDemo(false)}
      />
      {showDemo && <DemoSection />}
    </div>
  )
}
