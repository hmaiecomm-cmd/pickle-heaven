'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Download, Printer, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import './print-styles.css'
import type {
  OperationMetrics,
  DailyOperationTrend,
  TimeSlotDistribution,
  CourtComparison,
  WeekdayComparison,
  BookingStatusDistribution,
  OperationAlert,
} from '@/server/operation-metrics'
import { MetricsCards } from './components/metrics-cards'
import { DailyTrendsChart } from './components/daily-trends'
import { TimeSlotChart } from './components/time-slots'
import { CourtComparisonChart } from './components/court-comparison'
import { WeekdayComparisonChart } from './components/weekday-comparison'
import { BookingStatusChart } from './components/booking-status'
import { DoorAccessCard } from './components/door-access'
import { AlertsSection } from './components/alerts'
import { SummarySection } from './components/summary'
import { downloadPDF, printReport } from './utils/download'

interface OperationsReportClientProps {
  metrics: OperationMetrics
  trends: DailyOperationTrend[]
  timeSlots: TimeSlotDistribution[]
  courts: CourtComparison[]
  weekday: WeekdayComparison[]
  bookingStatus: BookingStatusDistribution
  alerts: OperationAlert[]
  summary: string
  period: { from: Date; to: Date }
  selectedDays: number
  fromDate: string
  toDate: string
}

export function OperationsReportClient({
  metrics,
  trends,
  timeSlots,
  courts,
  weekday,
  bookingStatus,
  alerts,
  summary,
  period,
  selectedDays,
  fromDate,
  toDate,
}: OperationsReportClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // 日期切換
  const handlePeriodChange = (days: number) => {
    const params = new URLSearchParams(searchParams)
    if (days === 0) {
      // 自訂日期模式
      params.delete('days')
    } else {
      params.set('days', String(days))
      params.delete('start')
      params.delete('end')
    }
    router.push(`?${params.toString()}`)
  }

  // 自訂日期變更
  const handleCustomDateChange = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams)
    params.delete('days')
    params.set('start', start)
    params.set('end', end)
    router.push(`?${params.toString()}`)
  }

  // 下載報表
  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadPDF({
        metrics,
        trends,
        timeSlots,
        courts,
        weekday,
        bookingStatus,
        alerts,
        summary,
        fromDate,
        toDate,
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // 列印報表
  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      printReport()
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 工具列 */}
      <div className="bg-white rounded-xl border border-[#e3e8dc] p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* 日期選擇 */}
          <div className="flex flex-wrap gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => handlePeriodChange(days)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  selectedDays === days
                    ? 'bg-[#7cb342] text-white'
                    : 'bg-white/80 text-[#1f4d34] hover:bg-white border border-[#e3e8dc]'
                )}
              >
                最近{days}天
              </button>
            ))}
            <button
              onClick={() => handlePeriodChange(0)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2',
                !selectedDays || selectedDays === 0
                  ? 'bg-[#7cb342] text-white'
                  : 'bg-white/80 text-[#1f4d34] hover:bg-white border border-[#e3e8dc]'
              )}
            >
              <Calendar className="h-4 w-4" />
              自訂日期
            </button>
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-4 py-2 rounded-lg bg-[#7cb342] text-white text-sm font-medium hover:bg-[#689b34] disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              下載報表
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 rounded-lg border border-[#e3e8dc] text-[#1f4d34] text-sm font-medium hover:bg-[#f0f4ed] disabled:opacity-50 flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              列印
            </button>
            <button
              onClick={() => router.refresh()}
              className="px-4 py-2 rounded-lg border border-[#e3e8dc] text-[#1f4d34] text-sm font-medium hover:bg-[#f0f4ed] flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              重新整理
            </button>
          </div>
        </div>

        {/* 日期範圍顯示 */}
        <div className="mt-3 text-xs text-muted">
          統計區間：{fromDate} 至 {toDate}
        </div>
      </div>

      {/* 主要統計卡片 */}
      <MetricsCards metrics={metrics} />

      {/* 圖表區域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 每日營運趨勢圖 */}
        {trends.length > 0 ? (
          <div className="lg:col-span-2">
            <DailyTrendsChart trends={trends} />
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e3e8dc] p-6 text-center text-muted">
            無每日趨勢資料
          </div>
        )}

        {/* 時段使用分布圖 */}
        {timeSlots.length > 0 ? (
          <TimeSlotChart timeSlots={timeSlots} />
        ) : (
          <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 text-center text-muted">
            無時段分布資料
          </div>
        )}

        {/* 場地比較 */}
        {courts.length > 0 ? (
          <CourtComparisonChart courts={courts} />
        ) : (
          <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 text-center text-muted">
            無場地資料
          </div>
        )}

        {/* 平日假日比較 */}
        {weekday.length > 0 ? (
          <WeekdayComparisonChart weekday={weekday} />
        ) : (
          <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 text-center text-muted">
            無平日假日資料
          </div>
        )}

        {/* 預約狀態 */}
        <BookingStatusChart bookingStatus={bookingStatus} />

        {/* 門禁與進出紀錄 */}
        <DoorAccessCard doorAccess={metrics.doorAccess} />
      </div>

      {/* 異常提示 */}
      {alerts.length > 0 && <AlertsSection alerts={alerts} />}

      {/* 營運狀況說明 */}
      <SummarySection summary={summary} />
    </div>
  )
}
