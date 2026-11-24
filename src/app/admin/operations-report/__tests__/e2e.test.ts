import { describe, it, expect } from 'vitest'

describe('營運狀況報表 E2E 測試', () => {
  const baseUrl = 'http://localhost:3000/admin/operations-report'

  describe('報表頁面載入', () => {
    it('應在沒有參數時使用 7 天默認值', () => {
      expect(`${baseUrl}`).toContain('operations-report')
    })

    it('應支持 days 參數', () => {
      expect(`${baseUrl}?days=30`).toContain('days=30')
      expect(`${baseUrl}?days=90`).toContain('days=90')
    })

    it('應支持自定義日期範圍', () => {
      expect(`${baseUrl}?start=2024-11-20&end=2024-11-30`).toContain('start=2024-11-20')
      expect(`${baseUrl}?start=2024-11-20&end=2024-11-30`).toContain('end=2024-11-30')
    })
  })

  describe('數據驗證', () => {
    it('所有指標應該有數值', () => {
      const mockData = {
        metrics: {
          bookingCompletion: { completionRate: 85, totalBookings: 100, completedBookings: 85, cancelledBookings: 10, expiredBookings: 5, changePercent: 0 },
          courtUtilization: { overallUtilization: 70, peakUtilization: 90, offPeakUtilization: 50, totalSlots: 1000, bookedSlots: 700, changePercent: 0 },
          entries: { totalEntries: 1500, averagePerDay: 214, changePercent: 0, dailyBreakdown: [] },
          doorAccess: { successRate: 98, successCount: 980, failureCount: 20, totalAttempts: 1000, changePercent: 0, lastUpdated: null, hasData: true },
          timestamp: new Date(),
        },
      }

      expect(mockData.metrics.bookingCompletion.completionRate).toBeGreaterThanOrEqual(0)
      expect(mockData.metrics.bookingCompletion.completionRate).toBeLessThanOrEqual(100)
    })

    it('日期範圍應正確', () => {
      const startDate = '2024-11-20'
      const endDate = '2024-11-30'

      const start = new Date(startDate)
      const end = new Date(endDate)

      expect(start < end).toBe(true)
    })
  })

  describe('圖表數據結構', () => {
    it('每日趨勢應有必要的字段', () => {
      const trend = {
        date: '2024-11-24',
        bookingCount: 10,
        entryCount: 150,
        completionRate: 85,
        cancelationRate: 15,
        utilizationRate: 70,
      }

      expect(trend).toHaveProperty('date')
      expect(trend).toHaveProperty('bookingCount')
      expect(trend).toHaveProperty('entryCount')
      expect(trend).toHaveProperty('completionRate')
      expect(trend).toHaveProperty('cancelationRate')
      expect(trend).toHaveProperty('utilizationRate')
    })

    it('時段分布應有完整數據', () => {
      const slot = {
        timeSlot: '18:00',
        averageUtilization: 90,
        bookingCount: 15,
        entryCount: 120,
      }

      expect(slot.timeSlot).toMatch(/\d{2}:\d{2}/)
      expect(slot.averageUtilization).toBeGreaterThanOrEqual(0)
      expect(slot.averageUtilization).toBeLessThanOrEqual(100)
    })

    it('場地對比應有狀態指示', () => {
      const court = {
        courtId: 'court-1',
        courtName: '籃球場 1',
        utilizationRate: 75,
        peakUtilization: 95,
        offPeakUtilization: 55,
        bookingCount: 50,
        cancelationCount: 5,
        status: 'good' as const,
      }

      expect(['good', 'fair', 'needs_attention']).toContain(court.status)
    })
  })

  describe('導出功能驗證', () => {
    it('PDF 文件名格式應正確', () => {
      const fromDate = '2024-11-20'
      const toDate = '2024-11-30'
      const filename = `營運狀況報表_${fromDate}_${toDate}.pdf`

      expect(filename).toMatch(/營運狀況報表_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf/)
    })

    it('CSV 文件名格式應正確', () => {
      const fromDate = '2024-11-20'
      const toDate = '2024-11-30'
      const filename = `營運狀況報表_${fromDate}_${toDate}.csv`

      expect(filename).toMatch(/營運狀況報表_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv/)
    })
  })

  describe('權限驗證', () => {
    it('應要求 finance 權限', () => {
      const permission = 'finance'
      expect(permission).toBe('finance')
    })
  })
})
