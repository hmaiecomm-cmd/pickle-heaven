'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FinanceTotals } from '@/server/finance-metrics'
import type { Period } from '@/app/admin/reports/report-data'

interface FinanceReportClientProps {
  totals: FinanceTotals
  courts: Array<{ court: string; amount: number; slots: number }>
  dailyData: Array<{ date: string; collected: number; refunded: number; orders: number }>
  period: Period
  selectedDays: number
}

export function FinanceReportClient({
  totals,
  courts,
  dailyData,
  period,
  selectedDays,
}: FinanceReportClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePeriodChange = (days: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('days', String(days))
    router.push(`?${params.toString()}`)
  }

  const totalRevenue = totals.collected
  const refunded = totals.refunded
  const netRevenue = totals.net
  const topupRevenue = totals.topup

  // 計算各類收入比例（基於預約明細分攤）
  const avgDailyRevenue = dailyData.length > 0 ? Math.round(dailyData.reduce((s, d) => s + d.collected, 0) / dailyData.length) : 0
  const totalOrders = dailyData.reduce((s, d) => s + d.orders, 0)

  return (
    <div className="space-y-6">
      {/* 期間切換 */}
      <div className="flex gap-2">
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => handlePeriodChange(days)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedDays === days
                ? 'bg-[#7cb342] text-white'
                : 'bg-white/80 text-[#1f4d34] hover:bg-white border border-[#e3e8dc]'
            )}
          >
            最近{days}天
          </button>
        ))}
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 總營收 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">總營收</p>
              <p className="text-2xl font-bold text-[#1f4d34] mt-1">NT${totalRevenue.toLocaleString()}</p>
            </div>
            <div className="text-[#7cb342]">
              <TrendingUp className="h-5 w-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-muted">淨收入：NT${netRevenue.toLocaleString()}</p>
        </div>

        {/* 場地訂單 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">成立訂單</p>
            <p className="text-2xl font-bold text-[#1f4d34] mt-1">{totalOrders}</p>
          </div>
          <p className="text-xs text-muted mt-4">平均日訂單：{totalOrders > 0 ? Math.ceil(totalOrders / dailyData.length) : 0}筆</p>
        </div>

        {/* 平均日收入 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">平均日收入</p>
            <p className="text-2xl font-bold text-[#1f4d34] mt-1">NT${avgDailyRevenue.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted mt-4">{selectedDays}天資料</p>
        </div>

        {/* 退款 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">退款金額</p>
              <p className="text-2xl font-bold text-red-600 mt-1">−NT${refunded.toLocaleString()}</p>
            </div>
            {refunded > 0 && <TrendingDown className="h-5 w-5 text-red-600" strokeWidth={1.5} />}
          </div>
          <p className="text-xs text-muted mt-4">退款筆數：{totals.refundCount}</p>
        </div>

        {/* 儲值收入 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">儲值收入</p>
            <p className="text-2xl font-bold text-[#1f4d34] mt-1">NT${topupRevenue.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted mt-4">儲值筆數：{totals.topupCount}</p>
        </div>

        {/* 核准費用 */}
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">核准費用</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">−NT${totals.expenses.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted mt-4">淨利：NT${(netRevenue - totals.expenses).toLocaleString()}</p>
        </div>
      </div>

      {/* 每日收入趨勢 */}
      {dailyData.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <h3 className="font-semibold text-[#1f4d34] mb-4">每日收入趨勢</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {dailyData.map((day) => (
              <div key={day.date} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted w-24">{day.date}</span>
                <div className="flex-1 ml-4">
                  <div className="relative h-6 bg-[#f0f4ed] rounded-full overflow-hidden">
                    {day.collected > 0 && (
                      <div
                        className="h-full bg-[#7cb342] flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${Math.min(100, (day.collected / (Math.max(...dailyData.map((d) => d.collected)) || 1)) * 100)}%` }}
                      >
                        {day.collected > 10000 && `NT$${Math.round(day.collected / 1000)}k`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right w-32">
                  <p className="font-medium text-[#1f4d34]">NT${day.collected.toLocaleString()}</p>
                  {day.orders > 0 && <p className="text-xs text-muted">{day.orders}筆訂單</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 球場收入排行 */}
      {courts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
          <h3 className="font-semibold text-[#1f4d34] mb-4">球場收入排行</h3>
          <div className="space-y-3">
            {courts.map((court, idx) => {
              const maxAmount = Math.max(...courts.map((c) => c.amount), 1)
              const percentage = Math.round((court.amount / maxAmount) * 100)
              return (
                <div key={court.court} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1f4d34]">
                      {idx + 1}. {court.court}
                    </span>
                    <span className="font-semibold text-[#7cb342]">NT${court.amount.toLocaleString()}</span>
                  </div>
                  <div className="relative h-4 bg-[#f0f4ed] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7cb342] flex items-center justify-center text-xs font-medium text-white"
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 20 && `${percentage}%`}
                    </div>
                  </div>
                  <p className="text-xs text-muted">{court.slots}場預約</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 財務統計摘要 */}
      <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
        <h3 className="font-semibold text-[#1f4d34] mb-4">財務統計摘要</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">支付筆數</p>
            <p className="text-xl font-bold text-[#1f4d34] mt-1">{totals.paymentCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">平均單筆金額</p>
            <p className="text-xl font-bold text-[#1f4d34] mt-1">NT${totals.paymentCount > 0 ? Math.round(totalRevenue / totals.paymentCount) : 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">退款比例</p>
            <p className="text-xl font-bold text-red-600 mt-1">{totalRevenue > 0 ? Math.round((refunded / totalRevenue) * 100) : 0}%</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">淨利潤</p>
            <p className="text-xl font-bold text-green-600 mt-1">NT${(netRevenue - totals.expenses).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
