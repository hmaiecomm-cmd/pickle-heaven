'use client'
import type { ChartType, UtilizationData } from './types'

export function UtilizationChartsPanel({ data, activeChart, onChartChange }: { data: UtilizationData; activeChart: ChartType; onChartChange: (c: ChartType) => void }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-bold text-[#1f3d2b] mb-4">收益策略分析</h2>
      <select value={activeChart} onChange={(e) => onChartChange(e.target.value as ChartType)} className="rounded-lg border px-3 py-2">
        <option value="heatmap">空場熱力分析</option>
        <option value="pricing">尖峰／離峰定價</option>
        <option value="discount-impact">離峰優惠成效</option>
      </select>
      <div className="mt-6 p-4 bg-zinc-50 rounded">
        <p className="text-sm text-muted">圖表區域（實現中）</p>
      </div>
    </section>
  )
}
