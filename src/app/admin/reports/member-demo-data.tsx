'use client'

/**
 * DEMO｜示範數據，之後可移除。
 * 移除方式：刪除本檔，並刪除 member-insights-dashboard.tsx 內的 <MemberDemoDatasection />（含 import）。
 * 真實數據完全不經過本檔。
 */
import * as React from 'react'
import { ChevronDown, FlaskConical } from 'lucide-react'
import type { MemberInsightsData } from './member-insights-types'

export const MockMemberInsightsData: MemberInsightsData = {
  range: { key: '30', from: '2026-10-27', to: '2026-11-26', days: 31, prevFrom: '2026-09-27', prevTo: '2026-10-26' },
  venueName: '示範場館',
  hasData: true,
  kpi: {
    memberRevenue: { value: 125600, prev: 110500, change: 13.6 },
    arpu: { value: 358, prev: 320, change: 11.9 },
    retention: { value: 68, prev: 62, change: 9.7 },
    conversion: { value: 48, prev: 42, change: 14.3 },
  },
  conversionFunnel: [
    { step: 'visitors', label: '全部訪客', count: 2850, percentage: 100 },
    { step: 'signups', label: '新會員', count: 580, percentage: 20 },
    { step: 'firstBooking', label: '首次預約', count: 280, percentage: 48 },
    { step: 'repeat', label: '重複預約', count: 185, percentage: 66 },
    { step: 'vip', label: 'VIP 轉化', count: 48, percentage: 26 },
  ],
  segments: [
    { segment: 'new', label: '新會員', count: 150, revenue: 12500, arpu: 83, engagement: 75 },
    { segment: 'active', label: '活躍會員', count: 580, revenue: 125600, arpu: 216, engagement: 85 },
    { segment: 'vip', label: 'VIP 會員', count: 85, revenue: 98500, arpu: 1159, engagement: 92 },
    { segment: 'atrisk', label: '風險會員', count: 120, revenue: 18200, arpu: 152, engagement: 35 },
    { segment: 'inactive', label: '不活躍會員', count: 340, revenue: 0, arpu: 0, engagement: 5 },
  ],
  charts: {
    arpu: { labels: ['近期', '前期'], values: [358, 320] },
    retention: { labels: ['第 1 周', '第 2 周', '第 4 周', '第 8 周'], values: [100, 72, 58, 42] },
    conversion: { labels: ['訪客', '新會員', '首次預約', '重複預約', 'VIP'], values: [2850, 580, 280, 185, 48] },
    ltv: { labels: ['新會員', '活躍會員', 'VIP'], values: [2500, 8600, 24000] },
    cohort: { labels: ['9 月', '10 月', '11 月'], values: [450, 520, 610] },
    lifecycle: { labels: ['新手期', '成長期', '穩定期', '衰退期'], values: [150, 580, 320, 85] },
    'revenue-by-segment': { labels: ['新會員', '活躍', 'VIP', '風險', '不活躍'], values: [12500, 125600, 98500, 18200, 0] },
    'growth-rate': { labels: ['1d', '2d', '3d', '4d', '5d', '6d', '7d'], values: [2.1, 1.8, 2.5, 1.2, 3.1, 2.4, 1.9] },
    churn: { labels: ['第 1 周', '第 2 周', '第 4 周', '第 8 周'], values: [0, 28, 42, 58] },
    engagement: { labels: ['高度活躍', '活躍', '低活躍', '非活躍'], values: [280, 420, 350, 185] },
  },
  dailyActions: [
    {
      id: 'low-conversion',
      priority: 'high',
      title: '新會員轉化率低',
      description: '新會員首次預約轉化率僅 48%，低於上期 42%',
      actionCount: 300,
      targetSegment: '新會員',
      estimatedImpact: '提升 5% 轉化率可增加 150+ 訂單',
    },
    {
      id: 'retention-drop',
      priority: 'high',
      title: '會員留存下滑',
      description: '四周留存率下降至 42%，需要重新激活策略',
      actionCount: 320,
      targetSegment: '中期會員',
      estimatedImpact: '改善流失可增加月營收 20%',
    },
    {
      id: 'vip-growth',
      priority: 'medium',
      title: '升級 VIP 推促',
      description: '活躍會員中有 240 人接近升級條件，可推送升級優惠',
      actionCount: 240,
      targetSegment: '活躍會員',
      estimatedImpact: '預計新增 60+ VIP，營收增加 10%',
    },
  ],
}

export function MemberDemoDataSection() {
  const [open, setOpen] = React.useState(false)
  const bodyId = React.useId()
  return (
    <section data-demo="member-insights" aria-label="示範資料" className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-3 sm:p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex min-h-11 w-full items-center gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <FlaskConical className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <span className="flex-1 text-sm font-bold text-amber-900">DEMO｜示範資料</span>
        <span className="hidden text-xs text-amber-800 sm:inline">以下數字為虛構，僅示範會員分析可能的樣貌</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={bodyId} className="mt-3 space-y-2">
          <div className="rounded-lg bg-amber-100/50 px-3 py-2 text-xs text-amber-900">
            ⚠️ <strong>這些數字不是球館的正式營運資料</strong>，僅用於示範會員分析功能。正式營運後會自動更新為真實數據，之後可完全移除此區塊。
          </div>
        </div>
      )}
    </section>
  )
}
