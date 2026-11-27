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
// 平日晚間 89%、假日 86%、平日離峰 31% 的示範資料
const heatValue = (d: number, h: number) => {
  const weekend = d >= 5
  const isEveningOrLate = h >= 12 && h <= 15 // 下午 4-6 點近似晚間時段
  const base = weekend
    ? (h >= 3 && h <= 11 ? 86 : 50)  // 假日：白天 86%, 晚間 50%
    : (isEveningOrLate ? 89 : 31)     // 平日：晚間 89%, 離峰 31%
  return Math.max(5, Math.min(98, base + ((d * 3 + h) % 7) - 3))
}

export const MockAnalyticsData: OverviewData = {
  range: { key: '7', from: '2027-01-20', to: '2027-01-26', days: 7, prevFrom: '2027-01-13', prevTo: '2027-01-19' },
  venueName: '示範場館（虛構資料）',
  courtOptions: [
    { id: 'demo-a', name: 'A 場' },
    { id: 'demo-b', name: 'B 場' },
  ],
  courtId: null,
  hasData: true,
  kpi: {
    // 近 7 天平均使用率 69.6%，前期 65.3%
    utilization: { value: 69.6, prev: 65.3, change: 4.3 },
    // 會員營收 NT$186,400，前期 NT$158,200
    revenue: { value: 186400, prev: 158200, change: 17.8 },
    // 訂單數 286，前期 258
    orders: { value: 286, prev: 258, change: 10.9 },
    // 有效會員 78，前期 72
    members: { value: 78, prev: 72, change: 8.3 },
  },
  // 7 天使用率：週一 61%, 週二 65%, 週三 68%, 週四 72%, 週五 75%, 週六 76%, 週日 70%
  usage: [61, 65, 68, 72, 75, 76, 70].map((value, i) => ({ label: DAYS[i], value })),
  heatmap: {
    hours: HOURS,
    rows: WEEK.map((label, d) => ({
      label,
      values: HOURS.map((_, h) => heatValue(d, h))
    }))
  },
  courts: [
    { id: 'demo-a', name: 'A 場', status: 'IN_USE', rate: 72 },
    { id: 'demo-b', name: 'B 場', status: 'IN_USE', rate: 64 },
  ],
  revenue: {
    // 7 天營收明細：近 7 天平均日營收 ~26,628，主要由預約、會員儲值組成
    series: [26600, 26500, 26700, 26800, 26400, 26600, 26800].map((total, i) => ({
      label: DAYS[i],
      court: Math.round(total * 0.44),    // 預約 44%
      event: Math.round(total * 0.00),   // 活動收入 0%
      topup: total - Math.round(total * 0.44),  // 會員儲值 56%
      total
    })),
    sources: [
      { key: 'court', label: '預約', amount: 82000, available: true },
      { key: 'topup', label: '會員儲值', amount: 104400, available: true },
      { key: 'event', label: '活動收入', amount: 0, available: false },
      { key: 'product', label: '商品與租借', amount: 0, available: false },
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
        <span className="flex-1 text-sm font-bold text-amber-900">DEMO｜示範資料</span>
        <span className="hidden text-xs text-amber-800 sm:inline">以下數字為虛構，僅示範球館正式營運後可能看到的報表樣貌</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={bodyId} className="mt-3 space-y-3">
          <p className="rounded-lg bg-amber-100/50 px-3 py-2 text-xs text-amber-900">
            ⚠️ <strong>這些數字不是目前球館的正式營運資料</strong>，僅用於示範報表功能。正式營運資料將在球館開始營運後自動更新。之後可以完全移除此 DEMO 區塊。
          </p>
          <ChartPanel data={MockAnalyticsData} chart={chart} onChart={setChart} idPrefix="demo" />
        </div>
      )}
    </section>
  )
}
