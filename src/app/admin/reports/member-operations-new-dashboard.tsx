'use client'
import { useState, useEffect } from 'react'
import type { MemberSegmentType } from './member-operations-new-types'
import { MEMBER_SEGMENT_LABELS } from './member-operations-new-types'
import { getKpiMetrics, getDemoContent } from './member-operations-new-data'
import { calculateDateRange } from './operation-utils'
import {
  MemberJourneyChart,
  MemberSegmentationChart,
  CohortAnalysisChart,
  LineMessagePerformanceChart,
  CancelNoShowTrendChart
} from './member-journey-charts'

export function MemberOperationsNewDashboard() {
  const [segment, setSegment] = useState<MemberSegmentType>('all')
  const [rangeMode, setRangeMode] = useState<'preset' | 'custom'>('preset')
  const [preset, setPreset] = useState<'7' | '30' | '90' | '180'>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showDemo, setShowDemo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDateRange = () => {
    if (rangeMode === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }
    const { from, to } = calculateDateRange(parseInt(preset))
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
  }

  const kpis = getKpiMetrics(segment)
  const demoContent = getDemoContent(segment)

  const segmentOptions = Object.entries(MEMBER_SEGMENT_LABELS).map(([key, { title }]) => ({
    value: key as MemberSegmentType,
    label: title
  }))

  const presetOptions = [
    { value: '7', label: '近 7 天' },
    { value: '30', label: '近 30 天' },
    { value: '90', label: '近 90 天' },
    { value: '180', label: '近 180 天' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* 標題 */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">會員經營與精準溝通</h1>
          <p className="text-sm md:text-base text-gray-600">根據營運痛點分析會員資料，提供精準推廣與溝通建議</p>
        </div>

        {/* 控制區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* 會員分群選單 */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">會員分群</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as MemberSegmentType)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {segmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 日期選擇 */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">查看期間</label>
            <select
              value={rangeMode === 'custom' ? 'custom' : preset}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setRangeMode('custom')
                } else {
                  setPreset(e.target.value as '7' | '30' | '90' | '180')
                  setRangeMode('preset')
                }
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {presetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">自訂日期</option>
            </select>
          </div>
        </div>

        {/* 自訂日期區域 (條件顯示) */}
        {rangeMode === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value)
                setRangeMode('custom')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="開始日期"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value)
                setRangeMode('custom')
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="結束日期"
            />
            <button
              onClick={() => {
                setRangeMode('preset')
                setPreset('30')
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-semibold"
            >
              清除
            </button>
          </div>
        )}

        {/* KPI 卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {kpis.map((kpi) => (
            <div
              key={kpi.name}
              className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow"
            >
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{kpi.name}</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl md:text-3xl font-bold text-gray-900">{kpi.value.toLocaleString()}</span>
                  <span
                    className={`text-sm font-semibold flex items-center gap-1 ${
                      kpi.trend === 'up'
                        ? 'text-green-600'
                        : kpi.trend === 'down'
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'} {Math.abs(kpi.change).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Demo 區塊 */}
        {showDemo && demoContent && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">DEMO</span>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">{demoContent.title}</h2>
              </div>
              <button
                onClick={() => setShowDemo(false)}
                className="px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
              >
                移除 Demo
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">目前狀況</h3>
                <p className="text-sm text-gray-700">{demoContent.status}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">可能原因</h3>
                <ul className="space-y-1">
                  {demoContent.causes.map((cause, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-orange-500">•</span>
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">建議行動</h3>
                <ul className="space-y-1">
                  {demoContent.actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">追蹤指標</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {demoContent.metrics.map((metric, idx) => (
                    <div key={idx} className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold text-center">
                      {metric}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 圖表區域 */}
        <div className="space-y-6 md:space-y-8">
          {/* 會員旅程 - 寬度全寬 */}
          <MemberJourneyChart />

          {/* 兩欄圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MemberSegmentationChart />
            <CohortAnalysisChart />
          </div>

          {/* 兩欄圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LineMessagePerformanceChart />
            <CancelNoShowTrendChart />
          </div>
        </div>
      </div>
    </div>
  )
}
