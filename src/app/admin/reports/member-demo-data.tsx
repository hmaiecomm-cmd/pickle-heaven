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
  venueName: '大新店森林匹克球',
  hasData: true,
  kpi: {
    memberRevenue: { value: 186400, prev: 164200, change: 13.5 },
    arpu: { value: 2390, prev: 2110, change: 13.2 },
    retention: { value: 68, prev: 62, change: 9.7 },
    conversion: { value: 48, prev: 42, change: 14.3 },
  },
  conversionFunnel: [
    { step: 'visitors', label: '首次接觸', count: 120, percentage: 100 },
    { step: 'signups', label: '第一次來場', count: 86, percentage: 72 },
    { step: 'firstBooking', label: '第二次消費', count: 52, percentage: 60 },
    { step: 'repeat', label: '儲值會員', count: 28, percentage: 54 },
    { step: 'vip', label: '月卡／季卡會員', count: 15, percentage: 54 },
  ],
  segments: [
    { segment: 'new', label: '單次體驗客', count: 35, revenue: 8750, arpu: 250, engagement: 45 },
    { segment: 'active', label: '高頻臨打客', count: 7, revenue: 24500, arpu: 3500, engagement: 95 },
    { segment: 'vip', label: '儲值會員', count: 28, revenue: 67200, arpu: 2400, engagement: 85 },
    { segment: 'atrisk', label: '沉睡會員', count: 12, revenue: 1800, arpu: 150, engagement: 10 },
    { segment: 'inactive', label: '月卡會員', count: 9, revenue: 36000, arpu: 4000, engagement: 70 },
  ],
  charts: {
    arpu: { labels: ['本期', '前期'], values: [2390, 2110] },
    retention: { labels: ['第 1 周', '第 2 周', '第 3 周', '第 4 周'], values: [100, 85, 72, 68] },
    conversion: { labels: ['首次接觸', '首次來場', '第二次消費', '儲值會員', '月卡季卡'], values: [120, 86, 52, 28, 15] },
    ltv: { labels: ['新客', '活躍會員', '高價值會員'], values: [1200, 8500, 24000] },
    cohort: { labels: ['9 月', '10 月', '11 月'], values: [78, 92, 120] },
    lifecycle: { labels: ['新手期', '成長期', '穩定期', '衰退期'], values: [35, 68, 25, 12] },
    'revenue-by-segment': { labels: ['單次客', '高頻客', '儲值會員', '沉睡會員', '月卡會員'], values: [8750, 24500, 67200, 1800, 36000] },
    'growth-rate': { labels: ['第1周', '第2周', '第3周', '第4周'], values: [28, 32, 30, 30] },
    churn: { labels: ['第 1 周', '第 2 周', '第 3 周', '第 4 周'], values: [0, 15, 13, 4] },
    engagement: { labels: ['高度活躍', '活躍', '低活躍', '非活躍'], values: [35, 50, 23, 12] },
  },
  dailyActions: [
    {
      id: 'high-freq-topup',
      priority: 'high',
      title: '高頻臨打客儲值推促',
      description: '7 位會員本月已消費 3 次以上，適合推薦儲值',
      actionCount: 7,
      targetSegment: '高頻臨打客',
      estimatedImpact: '預計增加 20% 月營收',
    },
    {
      id: 'seasonal-expiring',
      priority: 'high',
      title: '季卡即將到期提醒',
      description: '8 位季卡會員將於 14 天內到期，適合提前續約',
      actionCount: 8,
      targetSegment: '季卡會員',
      estimatedImpact: '提高 60% 續約率',
    },
    {
      id: 'inactive-reactivate',
      priority: 'medium',
      title: '沉睡會員喚回',
      description: '12 位會員超過 30 天未消費，適合發送喚回訊息',
      actionCount: 12,
      targetSegment: '沉睡會員',
      estimatedImpact: '預計恢復 40% 活躍度',
    },
    {
      id: 'offpeak-promote',
      priority: 'medium',
      title: '離峰優惠推送',
      description: '明日下午 B 場有 3 個空場，適合推送離峰優惠',
      actionCount: 24,
      targetSegment: '全體會員',
      estimatedImpact: '預計增加 8-12 筆訂單',
    },
    {
      id: 'champion-referral',
      priority: 'low',
      title: '主揪會員轉介獎勵',
      description: '4 位主揪會員本月帶來超過 20 位同行球友',
      actionCount: 4,
      targetSegment: '主揪會員',
      estimatedImpact: '提高轉介意願 25%',
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
