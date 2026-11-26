'use client'
import { useState, useEffect } from 'react'
import type { OperationTheme, OperationData } from './member-operations-types'
import { OPERATION_THEME_LABELS } from './member-operations-types'
import { calculateDateRange } from './operation-utils'
import { OperationDateRangePicker } from './operation-date-range-picker'
import { DropdownSelector } from './operation-dropdown-selector'
import { OperationKpiDisplay } from './operation-kpi-display'
import { OperationMemberList } from './operation-member-list'

export function MemberOperationsDashboard({ initialTheme, initialRangeDays }: any) {
  const [theme, setTheme] = useState<OperationTheme>(initialTheme || 'off-peak-fill')
  const [rangeMode, setRangeMode] = useState<'preset' | 'custom'>('preset')
  const [preset, setPreset] = useState<'7' | '30' | '90' | '180'>((initialRangeDays || '30').toString() as any)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<OperationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 獲取日期範圍
  const getDateRange = () => {
    if (rangeMode === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo, days: Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24)) }
    }
    const { from, to } = calculateDateRange(parseInt(preset))
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0], days: parseInt(preset) }
  }

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

  if (error) {
    return (
      <div className="p-6">
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
    <div className="space-y-6 pb-12">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold">會員經營與精準溝通</h1>
        <p className="text-sm text-gray-500 mt-1">根據營運痛點分析會員資料，提供精準推廣建議</p>
      </div>

      {/* 選擇器行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DropdownSelector
          label="選擇營運痛點"
          value={theme}
          options={themeOptions}
          onChange={(value) => setTheme(value as OperationTheme)}
        />
        <div>
          {/* 日期範圍選擇稍後單獨顯示 */}
        </div>
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
        <div className="p-12 text-center">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-[#2f7d3b] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600">加載數據中...</p>
        </div>
      )}

      {/* 數據內容 */}
      {!loading && data && (
        <>
          {/* KPI 顯示 */}
          <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
            <h2 className="mb-4 text-base font-bold">關鍵指標</h2>
            <OperationKpiDisplay kpis={data.summary.kpis} />
          </div>

          {/* 推薦卡片 */}
          {data.recommendation && (
            <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
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
                  <div className="grid grid-cols-2 gap-2">
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

          {/* 日常行動計劃 */}
          {data.dailyActions.map((action, i) => (
            <div key={i} className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold">{action.title}</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">目標客數: {action.targetCount}</span>
              </div>
            </div>
          ))}

          {/* AI 分析按鈕 */}
          <button className="w-full md:w-auto px-6 py-3 bg-[#2f7d3b] text-white rounded-lg font-semibold hover:bg-[#1f5a2b] transition">
            🤖 AI 幫我分析會員營運
          </button>
        </>
      )}
    </div>
  )
}
