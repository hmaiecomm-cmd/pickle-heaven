'use client'
import { useState } from 'react'
import type { OperationChartType } from './member-operations-charts'
import { CHART_LABELS, generateChartData } from './member-operations-charts'
import { DropdownSelector } from './operation-dropdown-selector'

export function OperationChartDisplay() {
  const [selectedChart, setSelectedChart] = useState<OperationChartType>('member-segmentation-count')
  const [loading, setLoading] = useState(false)

  const chartData = generateChartData(selectedChart)
  const chartInfo = CHART_LABELS[selectedChart]

  const chartOptions = Object.entries(CHART_LABELS).map(([key, { title }]) => ({
    value: key,
    label: title
  }))

  // 簡易圖表渲染（柱狀圖/圓餅圖）
  const isPercentage = chartData.some(d => d.percentage)
  const maxValue = Math.max(...chartData.map(d => d.value))

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6 space-y-6">
      {/* 圖表選擇器 */}
      <DropdownSelector
        label="選擇圖表"
        value={selectedChart}
        options={chartOptions}
        onChange={(value) => setSelectedChart(value as OperationChartType)}
      />

      {/* 圖表標題與說明 */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">{chartInfo.title}</h2>
        <div className="bg-[#f1f5ec] p-4 rounded-lg">
          <p className="text-sm text-gray-700">{chartInfo.description}</p>
        </div>
      </div>

      {/* 圖表數據顯示 */}
      <div className="space-y-4">
        {chartData.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold flex-1">{item.label}</span>
              <span className="text-gray-600 ml-2">
                {item.percentage ? `${item.percentage.toFixed(1)}%` : item.value}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#2f7d3b] h-full transition-all"
                style={{
                  width: `${(item.value / maxValue) * 100}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 數據統計 */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#e3e8dc]">
        <div className="bg-[#f1f5ec] p-3 rounded-lg">
          <div className="text-xs text-gray-600">總人數/總額</div>
          <div className="text-lg font-bold text-[#2f7d3b]">
            {chartData.reduce((sum, d) => sum + d.value, 0)}
          </div>
        </div>
        <div className="bg-[#f1f5ec] p-3 rounded-lg">
          <div className="text-xs text-gray-600">平均值</div>
          <div className="text-lg font-bold text-[#2f7d3b]">
            {(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length).toFixed(0)}
          </div>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2 pt-4 border-t border-[#e3e8dc]">
        <button className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 transition">
          📥 下載圖表
        </button>
        <button className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-200 transition">
          🤖 AI 分析此圖表
        </button>
      </div>
    </div>
  )
}
