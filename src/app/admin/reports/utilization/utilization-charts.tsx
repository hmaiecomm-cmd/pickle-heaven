'use client'
import type { ChartType, UtilizationData, HeatmapCell } from './types'

interface UtilizationChartsPanelProps {
  data: UtilizationData
  activeChart: ChartType
  onChartChange: (c: ChartType) => void
}

// 熱力圖數據轉換函數
function groupHeatmapByDayAndHour(heatmap: HeatmapCell[]) {
  const daysOfWeek = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
  const grouped: Record<number, Record<number, number>> = {}

  for (const cell of heatmap) {
    if (!grouped[cell.dayIndex]) grouped[cell.dayIndex] = {}
    grouped[cell.dayIndex][cell.slotIndex] = cell.rate
  }

  return { daysOfWeek, grouped }
}

// 顏色函數 - 根據使用率返回顏色
function getHeatColor(rate: number): string {
  if (rate >= 80) return 'bg-red-500'
  if (rate >= 75) return 'bg-orange-400'
  if (rate >= 60) return 'bg-amber-300'
  if (rate >= 30) return 'bg-lime-200'
  return 'bg-green-200'
}

function HeatmapChart({ heatmap, timeSlots }: { heatmap: HeatmapCell[]; timeSlots: string[] }) {
  const { daysOfWeek, grouped } = groupHeatmapByDayAndHour(heatmap)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left font-semibold text-[#1f2a22] border border-zinc-200">時段</th>
              {daysOfWeek.map((day, i) => (
                <th key={i} className="p-1 text-center font-semibold text-[#1f2a22] border border-zinc-200 bg-zinc-50">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, hourIdx) => (
              <tr key={hourIdx}>
                <td className="p-1 font-semibold text-[#1f2a22] border border-zinc-200 bg-zinc-50">{slot}</td>
                {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                  const rate = grouped[dayIdx]?.[hourIdx] ?? 0
                  return (
                    <td
                      key={dayIdx}
                      className={cn('p-2 border border-zinc-200 text-center font-semibold text-sm', getHeatColor(rate))}
                      title={`${rate}%`}
                    >
                      {rate}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 text-xs p-3 bg-zinc-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-500 rounded"></div>
          <span>高峰 ≥80%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-400 rounded"></div>
          <span>75%～79%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-300 rounded"></div>
          <span>60%～74%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-lime-200 rounded"></div>
          <span>30%～59%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-200 rounded"></div>
          <span>低峰 &lt;30%</span>
        </div>
      </div>
    </div>
  )
}

function CourtUsageChart({ courts }: { courts: Array<{ id: string; name: string }> }) {
  // Mock 數據 - 實際應該從 data 傳入
  const courtUsage = courts.map((court, idx) => ({
    name: court.name,
    rate: Math.random() * 100 | 0
  }))

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[#1f2a22] text-sm">各場地使用率</h3>
      <div className="space-y-2">
        {courtUsage.map((court, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-20 text-xs text-[#1f2a22] truncate">{court.name}</span>
            <div className="flex-1 bg-zinc-200 rounded-full h-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-end pr-2"
                style={{ width: `${court.rate}%` }}
              >
                {court.rate > 20 && <span className="text-xs font-bold text-white">{court.rate}%</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'

export function UtilizationChartsPanel({ data, activeChart, onChartChange }: UtilizationChartsPanelProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-bold text-[#1f3d2b]">收益策略分析</h2>

      {/* 圖表選擇器 - 僅在需要時顯示 */}
      {false && (
        <select value={activeChart} onChange={(e) => onChartChange(e.target.value as ChartType)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="heatmap">空場熱力分析</option>
          <option value="pricing">尖峰／離峰定價</option>
          <option value="discount-impact">離峰優惠成效</option>
        </select>
      )}

      {/* 響應式圖表布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左側：熱力圖 */}
        <div>
          <h3 className="font-semibold text-[#1f2a22] text-sm mb-3">時段 × 星期使用率熱力圖</h3>
          <HeatmapChart heatmap={data.heatmap} timeSlots={data.timeSlots} />
        </div>

        {/* 右側：場地使用率圖 */}
        <div>
          <CourtUsageChart courts={data.courts} />
        </div>
      </div>
    </section>
  )
}
