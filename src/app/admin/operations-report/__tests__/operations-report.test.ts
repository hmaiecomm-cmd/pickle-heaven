import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  getOperationMetrics,
  getBookingCompletionMetrics,
  getCourtUtilizationMetrics,
  getEntryMetrics,
  getDoorAccessMetrics,
  getDailyOperationTrends,
  getTimeSlotDistribution,
  getCourtComparison,
  getWeekdayComparison,
  getBookingStatusDistribution,
  getOperationAlerts,
  generateOperationSummary,
} from '@/server/operation-metrics'

describe('操作報表數據函數', () => {
  const testDate = '2024-11-24'
  const testToDate = '2024-11-30'

  describe('getOperationMetrics', () => {
    it('應該返回有效的操作指標', async () => {
      const result = await getOperationMetrics(testDate, testToDate)

      expect(result).toHaveProperty('bookingCompletion')
      expect(result).toHaveProperty('courtUtilization')
      expect(result).toHaveProperty('entries')
      expect(result).toHaveProperty('doorAccess')
      expect(result).toHaveProperty('timestamp')
    })

    it('預約完成率應在 0-100 之間', async () => {
      const result = await getOperationMetrics(testDate, testToDate)
      expect(result.bookingCompletion.completionRate).toBeGreaterThanOrEqual(0)
      expect(result.bookingCompletion.completionRate).toBeLessThanOrEqual(100)
    })

    it('場地利用率應在合理範圍內', async () => {
      const result = await getOperationMetrics(testDate, testToDate)
      expect(result.courtUtilization.overallUtilization).toBeGreaterThanOrEqual(0)
      expect(result.courtUtilization.overallUtilization).toBeLessThanOrEqual(100)
    })
  })

  describe('getBookingCompletionMetrics', () => {
    it('應正確計算預約完成統計', async () => {
      const from = new Date(`${testDate}T00:00:00+08:00`)
      const to = new Date(`${testToDate}T23:59:59+08:00`)

      const result = await getBookingCompletionMetrics(from, to)

      expect(result.completionRate).toBeDefined()
      expect(result.totalBookings).toBeGreaterThanOrEqual(0)
      expect(result.completedBookings).toBeGreaterThanOrEqual(0)
      expect(result.completedBookings).toBeLessThanOrEqual(result.totalBookings)
    })
  })

  describe('getEntryMetrics', () => {
    it('應返回進場統計和每日明細', async () => {
      const from = new Date(`${testDate}T00:00:00+08:00`)
      const to = new Date(`${testToDate}T23:59:59+08:00`)

      const result = await getEntryMetrics(from, to)

      expect(result.totalEntries).toBeGreaterThanOrEqual(0)
      expect(result.averagePerDay).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.dailyBreakdown)).toBe(true)
    })
  })

  describe('getDailyOperationTrends', () => {
    it('應返回每日趨勢數據', async () => {
      const result = await getDailyOperationTrends(testDate, testToDate)

      expect(Array.isArray(result)).toBe(true)
      result.forEach((trend) => {
        expect(trend.date).toBeDefined()
        expect(trend.bookingCount).toBeGreaterThanOrEqual(0)
        expect(trend.entryCount).toBeGreaterThanOrEqual(0)
        expect(trend.completionRate).toBeGreaterThanOrEqual(0)
        expect(trend.completionRate).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('getTimeSlotDistribution', () => {
    it('應返回時段分布數據', async () => {
      const result = await getTimeSlotDistribution(testDate, testToDate)

      expect(Array.isArray(result)).toBe(true)
      result.forEach((slot) => {
        expect(slot.timeSlot).toBeDefined()
        expect(slot.averageUtilization).toBeGreaterThanOrEqual(0)
        expect(slot.bookingCount).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('getCourtComparison', () => {
    it('應返回場地對比數據', async () => {
      const result = await getCourtComparison(testDate, testToDate)

      expect(Array.isArray(result)).toBe(true)
      result.forEach((court) => {
        expect(court.courtName).toBeDefined()
        expect(['good', 'fair', 'needs_attention']).toContain(court.status)
        expect(court.utilizationRate).toBeGreaterThanOrEqual(0)
        expect(court.utilizationRate).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('getWeekdayComparison', () => {
    it('應返回平日和假日對比', async () => {
      const result = await getWeekdayComparison(testDate, testToDate)

      expect(result).toHaveLength(2)
      expect(result[0].weekday).toBe('weekday')
      expect(result[1].weekday).toBe('weekend')

      result.forEach((item) => {
        expect(item.avgUtilization).toBeGreaterThanOrEqual(0)
        expect(item.avgBookings).toBeGreaterThanOrEqual(0)
        expect(item.avgEntries).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('getBookingStatusDistribution', () => {
    it('應返回預約狀態分布', async () => {
      const result = await getBookingStatusDistribution(testDate, testToDate)

      expect(result).toHaveProperty('completed')
      expect(result).toHaveProperty('pending')
      expect(result).toHaveProperty('cancelled')
      expect(result.completed).toBeGreaterThanOrEqual(0)
      expect(result.pending).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getOperationAlerts', () => {
    it('應返回操作異常提示', async () => {
      const result = await getOperationAlerts(testDate, testToDate)

      expect(Array.isArray(result)).toBe(true)
      result.forEach((alert) => {
        expect(['low_utilization', 'high_failures', 'court_gap', 'no_data']).toContain(alert.type)
        expect(['info', 'warning', 'error']).toContain(alert.severity)
        expect(alert.title).toBeDefined()
        expect(alert.message).toBeDefined()
      })
    })
  })

  describe('generateOperationSummary', () => {
    it('應生成操作摘要文本', async () => {
      const metrics = await getOperationMetrics(testDate, testToDate)
      const summary = await generateOperationSummary(metrics)

      expect(typeof summary).toBe('string')
      if (summary.length > 0) {
        expect(summary.length).toBeGreaterThan(0)
      }
    })
  })
})
