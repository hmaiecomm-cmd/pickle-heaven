'use client'

/**
 * DEMO｜示範數據，之後可移除。
 * 移除方式：刪除本檔，並刪除 member-insights-dashboard.tsx 內的 <MemberDemoDatasection />（含 import）。
 * 真實數據完全不經過本檔。
 */
import * as React from 'react'
import { ChevronDown, FlaskConical } from 'lucide-react'
import type { MemberInsightsData } from './member-insights-types'
import type { MemberAiInsightResult } from './member-insights-ai'

export const MockMemberInsightsData: MemberInsightsData = {
  range: { key: '30', from: '2026-10-27', to: '2026-11-26', days: 31, prevFrom: '2026-09-27', prevTo: '2026-10-26' },
  venueName: '大新店森林匹克球',
  hasData: true,
  kpi: {
    memberRevenue: { value: 186400, prev: 164200, change: 13.5 },
    arpu: { value: 2390, prev: 2110, change: 13.2 },
    retention: { value: 68, prev: 62, change: 9.7 },
    conversion: { value: 48, prev: 42, change: 14.3 },
    activeMembers: { value: 78, prev: 62, change: 25.8 },
    retention30d: { value: 52, prev: 38, change: 36.8 },
  },
  conversionFunnel: [
    { step: 'visitors', label: '全部訪客', count: 2450, percentage: 100 },
    { step: 'signups', label: '新會員註冊', count: 1680, percentage: 69 },
    { step: 'firstBooking', label: '首次預約', count: 892, percentage: 53 },
    { step: 'repeat', label: '重複預約', count: 456, percentage: 51 },
    { step: 'vip', label: 'VIP 會員', count: 128, percentage: 28 },
  ],
  segments: [
    { segment: 'new', label: '新會員', count: 150, revenue: 12500, arpu: 83, engagement: 75 },
    { segment: 'active', label: '活躍會員', count: 580, revenue: 125600, arpu: 216, engagement: 85 },
    { segment: 'vip', label: 'VIP 會員', count: 85, revenue: 98500, arpu: 1159, engagement: 92 },
    { segment: 'atrisk', label: '風險會員', count: 120, revenue: 18200, arpu: 152, engagement: 35 },
    { segment: 'inactive', label: '不活躍會員', count: 340, revenue: 0, arpu: 0, engagement: 5 },
  ],
  charts: {
    arpu: { labels: ['本期', '前期'], values: [2390, 2110] },
    retention: { labels: ['第 1 周', '第 2 周', '第 3 周', '第 4 周', '第 8 周'], values: [100, 68, 48, 32, 18] },
    conversion: { labels: ['全部訪客', '新會員', '首次預約', '重複預約', 'VIP 會員'], values: [2450, 1680, 892, 456, 128] },
    ltv: { labels: ['新會員', '活躍會員', 'VIP 會員'], values: [2500, 8600, 24000] },
    cohort: { labels: ['1 月', '2 月', '3 月', '4 月', '5 月'], values: [450, 520, 610, 580, 720] },
    lifecycle: { labels: ['新手期', '成長期', '穩定期', '衰退期'], values: [150, 580, 320, 85] },
    'revenue-by-segment': { labels: ['新會員', '活躍會員', 'VIP 會員', '風險會員', '不活躍'], values: [12500, 125600, 98500, 18200, 0] },
    'growth-rate': { labels: ['第1週', '第2週', '第3週', '第4週', '第5週'], values: [45, 52, 48, 55, 62] },
    churn: { labels: ['第 1 周', '第 2 周', '第 3 周', '第 4 周', '第 8 周'], values: [0, 32, 52, 68, 82] },
    engagement: { labels: ['高度活躍', '活躍', '低活躍', '非活躍'], values: [280, 420, 350, 185] },
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

export const DemoAiInsightResult: MemberAiInsightResult = {
  findings: [
    '會員營收佔總營收 64.2%，代表儲值與卡類會員已形成穩定收入',
    '平日下午使用率只有 28%，是當前最大的營收提升機會',
    '高頻臨打客（7 位）本月消費 3 次以上但尚未儲值，轉換潛力大',
  ],
  issues: [
    '平日中午到下午的使用率偏低（28%），場地有閒置風險',
    '單次體驗客（35 位）中有 65% 未再次消費，新客留存待改善',
    '沉睡會員（12 位）已超過 30 天未消費，需主動喚回',
  ],
  actions: [
    '針對曾在平日下午消費、但本週尚未預約的會員推出 75 折離峰券',
    '對 7 位高頻臨打客推送儲值加贈方案，預計月營收增加 10%',
    '針對沉睡會員發送回訪訊息，搭配優惠課程試上機會',
    '強化首次消費後的提醒機制，提升單次客轉率（目標 50%）',
  ],
  generatedAt: new Date().toISOString(),
}

export function MemberDemoDataSection() {
  const [open, setOpen] = React.useState(false)
  const bodyId = React.useId()
  return (
    <section data-demo="member-insights" aria-label="示範資料" className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-3 sm:p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex min-h-11 w-full items-center gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <FlaskConical className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <span className="flex-1 text-sm font-bold text-amber-900">DEMO｜營收與會員成長示範資料</span>
        <span className="hidden text-xs text-amber-800 sm:inline">以下為虛構資料，僅示範球館正式使用系統後可能看到的報表內容</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={bodyId} className="mt-3 space-y-3">
          <div className="rounded-lg bg-amber-100/50 px-3 py-2 text-xs text-amber-900">
            <strong>✨ 目前正在查看 DEMO 示範資料</strong>
            <p className="mt-1">以下為虛構資料，僅示範球館正式使用系統後可能看到的報表內容，並非目前正式營運資料。正式營運後會自動更新為真實數據，之後可完全移除此區塊。</p>
          </div>
          <div className="text-xs text-amber-800 space-y-2 pt-2 border-t border-amber-200">
            <p><strong>DEMO 資訊：</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>場館：大新店森林匹克球</li>
              <li>場地：A 場、B 場（2 面）</li>
              <li>營業時間：每日 08:00～23:00</li>
              <li>示範期間：2026 年 11 月 1 日～30 日（近 30 天）</li>
              <li>示範會員數：120 位</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
