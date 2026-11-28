'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ChartKeyMember, MemberInsightsData } from './member-insights-types'
import { CHART_CONFIGS } from './member-chart-config'

export function MemberChartDetailed({
  data,
  chartKey,
  isDemo,
}: {
  data: MemberInsightsData
  chartKey: ChartKeyMember
  isDemo: boolean
}) {
  const config = CHART_CONFIGS[chartKey]
  const chartData = data.charts[chartKey]

  if (!config || !chartData) {
    return <div className="text-center text-muted">圖表不可用</div>
  }

  const evaluation = config.evaluation(data)

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white shadow-sm overflow-hidden">
      {/* 標題區 */}
      <div className="border-b border-[#e3e8dc] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[#1f2a22]">{config.title}</h3>
            <p className="mt-1 text-sm text-muted">{config.description}</p>
          </div>
          {isDemo && (
            <span className="shrink-0 inline-flex items-center rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
              DEMO
            </span>
          )}
        </div>
      </div>

      {/* 圖表區 - 簡單柱狀圖 */}
      <div className="px-4 py-6 sm:px-5 sm:py-8 bg-[#fafbf8]">
        <div className="flex h-64 sm:h-80 items-end justify-center gap-2 rounded-lg bg-white p-4 sm:p-6 border border-[#e3e8dc]">
          {chartData.values.length > 0 ? (
            <>
              {chartData.values.map((value, idx) => {
                const maxValue = Math.max(...chartData.values)
                const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0
                const colors = [
                  '#2f7d3b', // 綠
                  '#5B8DEE', // 藍
                  '#9C6BA8', // 紫
                  '#F59E0B', // 橘
                  '#EF4444', // 紅
                ]
                const color = colors[idx % colors.length]

                return (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-3">
                    <div className="relative flex w-full flex-col items-center justify-end" style={{ height: '200px' }}>
                      <div
                        className="w-full rounded-t-lg transition-all"
                        style={{
                          backgroundColor: color,
                          height: `${heightPercent}%`,
                        }}
                        title={`${chartData.labels[idx]}: ${value}`}
                      />
                    </div>
                    <div className="text-xs font-semibold text-[#3d4a40] text-center">{chartData.labels[idx]}</div>
                    <div className="text-sm font-bold" style={{ color }}>
                      {value.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="flex items-center justify-center text-muted">無資料</div>
          )}
        </div>

        {/* 資料表 */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e3e8dc]">
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
      </div>

      {/* 說明區 */}
      <div className="border-t border-[#e3e8dc] px-4 py-4 sm:px-5 sm:py-5">
        <h4 className="text-sm font-bold text-[#1f4d34]">圖表用途</h4>
        <p className="mt-2 text-sm leading-relaxed text-[#3d4a40]">{config.purpose}</p>
      </div>

      {/* 評估區 */}
      <div className="border-t border-[#e3e8dc] px-4 py-4 sm:px-5 sm:py-5 bg-[#f0f9e8]">
        <h4 className="text-sm font-bold text-[#1f4d34]">會員或營運狀況評估</h4>
        <p className="mt-2 text-sm leading-relaxed text-[#2f5a3b]">{evaluation}</p>
      </div>
    </div>
  )
}
