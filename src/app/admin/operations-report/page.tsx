import { pagePermission } from '@/lib/admin-auth'
import { PageTitle } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { periodOf } from '@/app/admin/reports/report-data'
import {
  getOperationMetrics,
  getDailyOperationTrends,
  getTimeSlotDistribution,
  getCourtComparison,
  getWeekdayComparison,
  getBookingStatusDistribution,
  getOperationAlerts,
  generateOperationSummary
} from '@/server/operation-metrics'
import { OperationsReportClient } from './operations-client'

export const metadata: Metadata = { title: '營運狀況報表' }
export const dynamic = 'force-dynamic'

export default async function OperationsReportPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await pagePermission('finance')
  const sp = await searchParams

  // 解析日期參數
  const days = sp.days === '30' || sp.days === '90' ? Number(sp.days) : 7
  const startDate = sp.start || undefined
  const endDate = sp.end || undefined

  // 決定日期範圍
  let fromDateStr: string
  let toDateStr: string
  let period: { from: Date; to: Date }

  if (startDate && endDate) {
    fromDateStr = startDate
    toDateStr = endDate
    period = { from: new Date(startDate), to: new Date(endDate) }
  } else {
    const p = periodOf(String(days))
    fromDateStr = p.from
    toDateStr = p.to
    period = { from: new Date(`${p.from}T00:00:00+08:00`), to: new Date(`${p.to}T23:59:59+08:00`) }
  }

  // 並行獲取所有數據
  const [
    metrics,
    trends,
    timeSlots,
    courts,
    weekday,
    bookingStatus,
    alerts,
  ] = await Promise.all([
    getOperationMetrics(fromDateStr, toDateStr),
    getDailyOperationTrends(fromDateStr, toDateStr),
    getTimeSlotDistribution(fromDateStr, toDateStr),
    getCourtComparison(fromDateStr, toDateStr),
    getWeekdayComparison(fromDateStr, toDateStr),
    getBookingStatusDistribution(fromDateStr, toDateStr),
    getOperationAlerts(fromDateStr, toDateStr),
  ])

  const summary = await generateOperationSummary(metrics)

  return (
    <div className="space-y-6">
      <PageTitle
        title="營運狀況報表"
        desc="即時掌握場地使用、預約與營運異常"
      />
      <OperationsReportClient
        metrics={metrics}
        trends={trends}
        timeSlots={timeSlots}
        courts={courts}
        weekday={weekday}
        bookingStatus={bookingStatus}
        alerts={alerts}
        summary={summary}
        period={period}
        selectedDays={days}
        fromDate={fromDateStr}
        toDate={toDateStr}
      />
    </div>
  )
}
