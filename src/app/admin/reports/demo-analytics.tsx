'use client'

/**
 * DEMO｜示範資料，之後可移除。
 * 移除方式：刪除本檔，並刪除 operations-dashboard.tsx 內唯一一行 <DemoAnalyticsSection />（含 import）。
 * 真實資料完全不經過本檔。
 */
import * as React from 'react'
import { ChevronDown, FlaskConical } from 'lucide-react'
import type { ChartKey, OverviewData } from './overview-types'
import { ChartPanel } from './overview-charts'

const DAYS = ['01/20', '01/21', '01/22', '01/23', '01/24', '01/25', '01/26']
const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
const WEEK = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
// 平日晚間、週末白天較熱門的固定示範曲線（不使用亂數，避免每次重新整理數字不同）
const heatValue = (d: number, h: number) => {
  const weekend = d >= 5
  const base = weekend ? (h >= 3 && h <= 11 ? 70 : 35) : h >= 12 ? 78 : h <= 2 ? 30 : 18
  return Math.max(5, Math.min(98, base + ((d * 7 + h * 3) % 17) - 8))
}

export const MockAnalyticsData: OverviewData = {
  range: { key: '7', from: '2027-01-20', to: '2027-01-26', days: 7, prevFrom: '2027-01-13', prevTo: '2027-01-19' },
  venueName: '示範場館',
  courtOptions: [],
  courtId: null,
  hasData: true,
  kpi: {
    utilization: { value: 72.4, prev: 66.6, change: 5.8 },
    revenue: { value: 126300, prev: 112170, change: 12.6 },
    orders: { value: 320, prev: 295, change: 8.5 },
    members: { value: 1892, prev: 1817, change: 4.1 },
  },
  usage: [61, 69, 63, 70, 66, 72, 76].map((value, i) => ({ label: DAYS[i], value })),
  heatmap: { hours: HOURS, rows: WEEK.map((label, d) => ({ label, values: HOURS.map((_, h) => heatValue(d, h)) })) },
  courts: [
    { id: 'demo-a', name: '場地 A', status: 'IN_USE', rate: 81 },
    { id: 'demo-b', name: '場地 B', status: 'AVAILABLE', rate: 64 },
    { id: 'demo-c', name: '場地 C', status: 'IN_USE', rate: 77 },
    { id: 'demo-d', name: '場地 D', status: 'MAINTENANCE', rate: 42 },
  ],
  revenue: {
    series: [16200, 17800, 15100, 18300, 17400, 20100, 21400].map((total, i) => ({ label: DAYS[i], court: Math.round(total * 0.62), event: Math.round(total * 0.23), topup: total - Math.round(total * 0.62) - Math.round(total * 0.23), total })),
    sources: [
      { key: 'court', label: '場地預約', amount: 78306, available: true },
      { key: 'event', label: '活動收入', amount: 29049, available: true },
      { key: 'topup', label: '會員方案（儲值）', amount: 18945, available: true },
      { key: 'product', label: '商品收入', amount: 0, available: false },
      { key: 'other', label: '其他收入', amount: 0, available: false },
    ],
  },
}

export function DemoAnalyticsSection() {
  const [open, setOpen] = React.useState(true)
  const [chart, setChart] = React.useState<ChartKey>('usage')
  const bodyId = React.useId()
  return (
    <section data-demo="analytics" aria-label="示範資料" className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-3 sm:p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex min-h-11 w-full items-center gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <FlaskConical className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <span className="flex-1 text-sm font-bold text-amber-900">DEMO｜示範資料，之後可移除</span>
        <span className="hidden text-xs text-amber-800 sm:inline">以下數字為虛構，僅示範圖表呈現方式</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={bodyId} className="mt-3">
          <ChartPanel data={MockAnalyticsData} chart={chart} onChart={setChart} idPrefix="demo" />
        </div>
      )}
    </section>
  )
}
