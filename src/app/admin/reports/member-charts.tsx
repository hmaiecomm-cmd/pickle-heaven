'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChartKeyMember, MemberInsightsData } from './member-insights-types'
import { CHART_META_MEMBER } from './member-insights-types'

const CHART_KEYS: ChartKeyMember[] = ['arpu', 'retention', 'conversion', 'ltv', 'cohort', 'lifecycle', 'revenue-by-segment', 'growth-rate', 'churn', 'engagement']

export function MemberChartsPanel({ data, activeChart, onChart }: { data: MemberInsightsData; activeChart: ChartKeyMember; onChart: (chart: ChartKeyMember) => void }) {
  const chartData = data.charts[activeChart]
  const chartMeta = CHART_META_MEMBER[activeChart]

  return (
    <div className="space-y-4">
      {/* 圖表主體與選擇器 */}
      <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2a22]">營收與會員成長分析</h3>
          <div className="flex flex-col xs:flex-row gap-2">
            <label className="text-xs sm:text-sm font-semibold text-[#3d4a40] self-start sm:self-center">選擇圖表：</label>
            <select
              value={activeChart}
              onChange={(e) => onChart(e.target.value as ChartKeyMember)}
              className="rounded-lg border border-[#d7dfcf] bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#3d4a40] hover:bg-[#f6f9f2] focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
            >
              {CHART_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CHART_META_MEMBER[key].title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 簡單柱狀圖 */}
        <div className="mt-4 flex h-56 sm:h-64 items-end justify-center gap-2 rounded-lg bg-[#f6f9f2] p-3 sm:p-4">
          {chartData.values.length > 0 ? (
            <>
              {chartData.values.map((value, idx) => {
                const maxValue = Math.max(...chartData.values)
                const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0
                return (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex w-full flex-col items-center justify-end" style={{ height: '180px' }}>
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-[#2f7d3b] to-[#4a9d5e] transition-all" style={{ height: `${heightPercent}%` }} />
                    </div>
                    <div className="text-xs font-semibold text-[#3d4a40]">{chartData.labels[idx] || `項目 ${idx + 1}`}</div>
                    <div className="text-xs font-bold text-[#2f7d3b]">{value.toLocaleString()}</div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="flex items-center justify-center text-muted">無資料</div>
          )}
        </div>

        {/* 資料表 */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#e3e8dc]">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#f6f9f2]">
              <tr>
                <th className="px-3 sm:px-4 py-2 text-left font-semibold text-[#3d4a40]">標籤</th>
                <th className="px-3 sm:px-4 py-2 text-right font-semibold text-[#3d4a40]">數值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8dc]">
              {chartData.labels.map((label, idx) => (
                <tr key={idx} className="hover:bg-[#fafbf8]">
                  <td className="px-3 sm:px-4 py-2 text-[#1f2a22]">{label}</td>
                  <td className="px-3 sm:px-4 py-2 text-right font-semibold text-[#2f7d3b]">{chartData.values[idx]?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 圖表說明卡片 */}
        <div className="mt-4 rounded-xl border border-[#e3e8dc] bg-[#fafbf8] p-3 sm:p-4">
          <h4 className="text-xs font-bold text-[#1f4d34] sm:text-sm">這張圖表怎麼看？</h4>
          <p className="mt-2 text-xs leading-relaxed text-[#3d4a40] sm:text-sm">{chartMeta.explanation}</p>
        </div>
      </div>
    </div>
  )
}
