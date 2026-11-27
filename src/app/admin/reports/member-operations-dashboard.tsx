'use client'
import { useState, useEffect } from 'react'
import type { OperationTheme, OperationData } from './member-operations-types'
import type { OperationChartType } from './member-operations-charts'
import { OPERATION_THEME_LABELS } from './member-operations-types'
import { CHART_LABELS, generateChartData } from './member-operations-charts'
import { calculateDateRange } from './operation-utils'
import { OperationDateRangePicker } from './operation-date-range-picker'
import { DropdownSelector } from './operation-dropdown-selector'
import { OperationKpiDisplay } from './operation-kpi-display'
import { OperationMemberList } from './operation-member-list'
import { OperationAIAnalysis } from './operation-ai-analysis'

export function MemberOperationsDashboard({ initialTheme, initialRangeDays }: any) {
  const [theme, setTheme] = useState<OperationTheme>(initialTheme || 'off-peak-fill')
  const [selectedChart, setSelectedChart] = useState<OperationChartType>('member-segmentation-count')
  const [rangeMode, setRangeMode] = useState<'preset' | 'custom'>('preset')
  const [preset, setPreset] = useState<'7' | '30' | '90' | '180'>((initialRangeDays || '30').toString() as any)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<OperationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDemoData, setShowDemoData] = useState(true)

  // 獲取日期範圍
  const getDateRange = () => {
    if (rangeMode === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo, days: Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24)) }
    }
    const { from, to } = calculateDateRange(parseInt(preset))
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0], days: parseInt(preset) }
  }

  // 更新查詢參數
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams()
      params.set('theme', theme)
      params.set('range', preset)
      if (rangeMode === 'custom' && customFrom && customTo) {
        params.set('mode', 'custom')
        params.set('from', customFrom)
        params.set('to', customTo)
      }
      params.set('chart', selectedChart)
      window.history.replaceState(null, '', `?${params.toString()}`)
    }
  }, [theme, preset, rangeMode, customFrom, customTo, selectedChart])

  // 獲取數據
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const range = getDateRange()
        const response = await fetch('/api/admin/member-operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme,
            range: { key: preset, from: range.from, to: range.to, days: range.days },
            venues: [],
            memberTypes: []
          })
        })

        if (!response.ok) {
          throw new Error(`API 錯誤: ${response.status}`)
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '發生未知錯誤'
        console.error('數據查詢失敗:', err)
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [theme, rangeMode, preset, customFrom, customTo])

  const themeOptions = Object.entries(OPERATION_THEME_LABELS).map(([key, { title, subtitle }]) => ({
    value: key,
    label: title,
    subtitle: subtitle
  }))

  const chartOptions = Object.entries(CHART_LABELS).map(([key, { title }]) => ({
    value: key,
    label: title
  }))

  const chartData = generateChartData(selectedChart)
  const chartInfo = CHART_LABELS[selectedChart]
  const maxValue = Math.max(...chartData.map(d => d.value))

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800 font-medium">⚠️ 資料載入失敗</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            重新載入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
      {/* 標題 */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">會員經營與精準溝通</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">根據營運痛點分析會員資料，提供精準推廣建議</p>
      </div>

      {/* 選擇器行 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <DropdownSelector
          label="選擇營運痛點"
          value={theme}
          options={themeOptions}
          onChange={(value) => setTheme(value as OperationTheme)}
        />
        <DropdownSelector
          label="選擇圖表"
          value={selectedChart}
          options={chartOptions}
          onChange={(value) => setSelectedChart(value as OperationChartType)}
        />
      </div>

      {/* 日期範圍選擇 */}
      <OperationDateRangePicker
        value={rangeMode}
        preset={preset}
        fromDate={customFrom}
        toDate={customTo}
        onRangeChange={(days) => {
          setRangeMode('preset')
          setPreset(days)
        }}
        onCustomChange={(from, to) => {
          setRangeMode('custom')
          setCustomFrom(from)
          setCustomTo(to)
        }}
      />

      {/* 加載中 */}
      {loading && (
        <div className="p-8 md:p-12 text-center">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-[#2f7d3b] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 text-sm md:text-base">加載數據中...</p>
        </div>
      )}

      {/* 數據內容 */}
      {!loading && data && (
        <>
          {/* KPI 顯示 */}
          <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 md:p-6">
            <h2 className="mb-4 text-base font-bold">關鍵指標</h2>
            <OperationKpiDisplay kpis={data.summary.kpis} />
          </div>

          {/* DEMO 資料區塊 */}
          <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">DEMO｜以下為虛構資料</span>
                示範會員資料
              </h2>
              <button
                onClick={() => setShowDemoData(!showDemoData)}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
              >
                {showDemoData ? '📖 收合' : '📖 展開'}
              </button>
            </div>
            {showDemoData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#f1f5ec] p-3 rounded-lg">
                    <p className="text-xs text-gray-600">總會員數</p>
                    <p className="text-lg font-bold text-[#2f7d3b]">120</p>
                  </div>
                  <div className="bg-[#f1f5ec] p-3 rounded-lg">
                    <p className="text-xs text-gray-600">付費會員</p>
                    <p className="text-lg font-bold text-[#2f7d3b]">78</p>
                  </div>
                  <div className="bg-[#f1f5ec] p-3 rounded-lg">
                    <p className="text-xs text-gray-600">活躍會員</p>
                    <p className="text-lg font-bold text-[#2f7d3b]">54</p>
                  </div>
                  <div className="bg-[#f1f5ec] p-3 rounded-lg">
                    <p className="text-xs text-gray-600">沉睡會員</p>
                    <p className="text-lg font-bold text-[#2f7d3b]">18</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    此示範資料為虛構，僅供演示功能。實際資料來自真實會員、預約及付款數據，系統會根據選擇的時間範圍與營運痛點動態計算。
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 圖表與說明 */}
          <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 md:p-6 space-y-4 md:space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-2">{chartInfo.title}</h2>
              <div className="bg-[#f1f5ec] p-3 md:p-4 rounded-lg">
                <h3 className="text-xs font-bold text-[#2f7d3b] mb-2">📖 這張圖表怎麼看？</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{chartInfo.description}</p>
              </div>
            </div>

            {/* 圖表數據顯示 */}
            <div className="space-y-3">
              {chartData.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="font-semibold flex-1 truncate">{item.label}</span>
                    <span className="text-gray-600 ml-2 flex-shrink-0">
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

            {/* 圖表統計 */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 pt-3 border-t border-[#e3e8dc]">
              <div className="bg-[#f1f5ec] p-3 rounded-lg">
                <div className="text-xs text-gray-600">總數</div>
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

            {/* 圖表操作按鈕 */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#e3e8dc]">
              <button className="px-3 md:px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs md:text-sm font-semibold hover:bg-blue-200 transition">
                📥 下載圖表
              </button>
              <button className="px-3 md:px-4 py-2 bg-green-100 text-green-700 rounded-lg text-xs md:text-sm font-semibold hover:bg-green-200 transition">
                🤖 分析此圖表
              </button>
            </div>
          </div>

          {/* 營運建議 */}
          {data.recommendation && (
            <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 md:p-6">
              <h2 className="mb-4 text-base font-bold">營運建議</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">目前狀況</h3>
                  <p className="text-sm text-gray-600">{data.recommendation.currentStatus}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">可能原因</h3>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {data.recommendation.possibleCauses.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">建議行動</h3>
                  <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                    {data.recommendation.suggestedActions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">追蹤指標</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {data.recommendation.trackedMetrics.map((metric, i) => (
                      <div key={i} className="bg-[#f1f5ec] p-2 rounded-lg text-xs font-semibold text-[#2f7d3b]">{metric}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 會員推薦名單 */}
          {data.memberList.length > 0 && (
            <OperationMemberList members={data.memberList} title={`符合條件的會員 (${data.memberList.length} 位)`} />
          )}

          {/* AI 分析 */}
          <OperationAIAnalysis
            painPoint={theme}
            dateRange={getDateRange()}
            memberCount={data.memberList.length}
          />
        </>
      )}

      {/* 無數據狀態 */}
      {!loading && !data && !error && (
        <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6 text-center">
          <p className="text-gray-600">暫無可用數據</p>
        </div>
      )}
    </div>
  )
}
