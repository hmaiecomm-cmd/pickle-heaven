import 'server-only'
import { prisma } from '@/lib/db'
import { now, taipeiDateString, addDays } from '@/lib/time'

export interface BookingCompletionMetrics {
  completionRate: number
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  expiredBookings: number
  changePercent: number
}

export interface CourtUtilizationMetrics {
  overallUtilization: number
  peakUtilization: number
  offPeakUtilization: number
  totalSlots: number
  bookedSlots: number
  changePercent: number
}

export interface EntryMetrics {
  totalEntries: number
  averagePerDay: number
  changePercent: number
  dailyBreakdown: Array<{ date: string; count: number }>
}

export interface DoorAccessMetrics {
  successRate: number
  successCount: number
  failureCount: number
  totalAttempts: number
  changePercent: number
  lastUpdated: Date | null
  hasData: boolean
}

export interface OperationMetrics {
  bookingCompletion: BookingCompletionMetrics
  courtUtilization: CourtUtilizationMetrics
  entries: EntryMetrics
  doorAccess: DoorAccessMetrics
  timestamp: Date
}

export interface DailyOperationTrend {
  date: string
  bookingCount: number
  entryCount: number
  completionRate: number
  cancelationRate: number
  utilizationRate: number
}

export interface TimeSlotDistribution {
  timeSlot: string
  averageUtilization: number
  bookingCount: number
  entryCount: number
}

export interface CourtComparison {
  courtId: string
  courtName: string
  utilizationRate: number
  peakUtilization: number
  offPeakUtilization: number
  bookingCount: number
  cancelationCount: number
  status: 'good' | 'fair' | 'needs_attention'
}

export interface WeekdayComparison {
  weekday: 'weekday' | 'weekend'
  avgUtilization: number
  avgBookings: number
  avgEntries: number
}

export interface BookingStatusDistribution {
  completed: number
  pending: number
  cancelled: number
  expired: number
  refunded: number
}

export interface OperationAlert {
  id: string
  type: 'low_utilization' | 'high_failures' | 'court_gap' | 'no_data'
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  action?: string
}

/**
 * 获取指定时间段的营运指标
 */
export async function getOperationMetrics(fromDate: string, toDate: string): Promise<OperationMetrics> {
  const from = new Date(`${fromDate}T00:00:00+08:00`)
  const to = new Date(`${toDate}T23:59:59+08:00`)

  const [bookingCompletion, courtUtilization, entries, doorAccess] = await Promise.all([
    getBookingCompletionMetrics(from, to),
    getCourtUtilizationMetrics(from, to),
    getEntryMetrics(from, to),
    getDoorAccessMetrics(from, to),
  ])

  return {
    bookingCompletion,
    courtUtilization,
    entries,
    doorAccess,
    timestamp: now(),
  }
}

async function getBookingCompletionMetrics(from: Date, to: Date): Promise<BookingCompletionMetrics> {
  const bookings = await prisma.booking.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: { status: true },
  })

  const completed = bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'PAID').length
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length
  const expired = bookings.filter((b) => b.status === 'EXPIRED').length
  const total = bookings.length

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // TODO: 計算與前一期的變化百分比
  const changePercent = 0

  return {
    completionRate,
    totalBookings: total,
    completedBookings: completed,
    cancelledBookings: cancelled,
    expiredBookings: expired,
    changePercent,
  }
}

async function getCourtUtilizationMetrics(from: Date, to: Date): Promise<CourtUtilizationMetrics> {
  // TODO: 實現場地使用率計算
  // 需要根據場地、時段、預約情況計算

  return {
    overallUtilization: 68,
    peakUtilization: 91,
    offPeakUtilization: 45,
    totalSlots: 1000,
    bookedSlots: 680,
    changePercent: 0,
  }
}

async function getEntryMetrics(from: Date, to: Date): Promise<EntryMetrics> {
  // TODO: 實現進場人次計算
  // 需要從進場紀錄或門禁紀錄中統計

  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))

  return {
    totalEntries: 1284,
    averagePerDay: Math.round(1284 / days),
    changePercent: 0,
    dailyBreakdown: [],
  }
}

async function getDoorAccessMetrics(from: Date, to: Date): Promise<DoorAccessMetrics> {
  // TODO: 實現門禁開門統計
  // 需要從門禁系統中取得資料

  return {
    successRate: 98,
    successCount: 1250,
    failureCount: 25,
    totalAttempts: 1275,
    changePercent: 0,
    lastUpdated: null,
    hasData: false,
  }
}

/**
 * 獲取每日營運趨勢
 */
export async function getDailyOperationTrends(fromDate: string, toDate: string): Promise<DailyOperationTrend[]> {
  // TODO: 實現每日趨勢數據
  return []
}

/**
 * 獲取時段使用分布
 */
export async function getTimeSlotDistribution(fromDate: string, toDate: string): Promise<TimeSlotDistribution[]> {
  // TODO: 實現時段分布數據
  const timeSlots = ['09:00', '12:00', '15:00', '18:00', '20:00', '22:00']
  return timeSlots.map((slot) => ({
    timeSlot: slot,
    averageUtilization: 0,
    bookingCount: 0,
    entryCount: 0,
  }))
}

/**
 * 獲取場地比較數據
 */
export async function getCourtComparison(fromDate: string, toDate: string): Promise<CourtComparison[]> {
  const courts = await prisma.court.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  // TODO: 實現各場地的詳細統計

  return courts.map((court) => ({
    courtId: court.id,
    courtName: court.name,
    utilizationRate: 0,
    peakUtilization: 0,
    offPeakUtilization: 0,
    bookingCount: 0,
    cancelationCount: 0,
    status: 'fair' as const,
  }))
}

/**
 * 獲取平日假日比較
 */
export async function getWeekdayComparison(fromDate: string, toDate: string): Promise<WeekdayComparison[]> {
  // TODO: 實現平日假日比較數據
  return [
    {
      weekday: 'weekday',
      avgUtilization: 54,
      avgBookings: 45,
      avgEntries: 380,
    },
    {
      weekday: 'weekend',
      avgUtilization: 88,
      avgBookings: 78,
      avgEntries: 650,
    },
  ]
}

/**
 * 獲取預約狀態分布
 */
export async function getBookingStatusDistribution(fromDate: string, toDate: string): Promise<BookingStatusDistribution> {
  const from = new Date(`${fromDate}T00:00:00+08:00`)
  const to = new Date(`${toDate}T23:59:59+08:00`)

  const statuses = await prisma.booking.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: from, lte: to },
    },
    _count: true,
  })

  const result: BookingStatusDistribution = {
    completed: 0,
    pending: 0,
    cancelled: 0,
    expired: 0,
    refunded: 0,
  }

  for (const { status, _count } of statuses) {
    if (status === 'COMPLETED' || status === 'PAID') result.completed += _count
    if (status === 'PENDING') result.pending += _count
    if (status === 'CANCELLED') result.cancelled += _count
    if (status === 'EXPIRED') result.expired += _count
    if (status === 'REFUND_PENDING') result.refunded += _count
  }

  return result
}

/**
 * 獲取營運異常提示
 */
export async function getOperationAlerts(fromDate: string, toDate: string): Promise<OperationAlert[]> {
  const alerts: OperationAlert[] = []

  // TODO: 根據實際數據生成異常提示

  return alerts
}

/**
 * 生成營運狀況文字說明
 */
export async function generateOperationSummary(metrics: OperationMetrics): Promise<string> {
  const lines: string[] = []

  if (metrics.bookingCompletion.completionRate > 85) {
    lines.push('本期整體預約穩定，完成率良好。')
  } else if (metrics.bookingCompletion.completionRate < 70) {
    lines.push('本期預約完成率偏低，建議檢查取消原因。')
  }

  if (metrics.courtUtilization.peakUtilization > 85) {
    lines.push('尖峰時段使用率接近滿場，可能需要增加排課或客源開發。')
  }

  if (metrics.courtUtilization.offPeakUtilization < 50) {
    lines.push('平日離峰時段仍有空間，建議安排教練課、團體活動或平日方案。')
  }

  return lines.join('\n')
}
