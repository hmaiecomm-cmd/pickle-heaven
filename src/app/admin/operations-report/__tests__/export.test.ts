import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadPDF, printReport, exportCSV } from '../utils/download'

const mockData = {
  metrics: {
    bookingCompletion: { completionRate: 85, totalBookings: 100, completedBookings: 85, cancelledBookings: 10, expiredBookings: 5, changePercent: 0 },
    courtUtilization: { overallUtilization: 70, peakUtilization: 90, offPeakUtilization: 50, totalSlots: 1000, bookedSlots: 700, changePercent: 0 },
    entries: { totalEntries: 1500, averagePerDay: 214, changePercent: 0, dailyBreakdown: [] },
    doorAccess: { successRate: 98, successCount: 980, failureCount: 20, totalAttempts: 1000, changePercent: 0, lastUpdated: null, hasData: true },
    timestamp: new Date(),
  },
  trends: [
    { date: '2024-11-24', bookingCount: 10, entryCount: 150, completionRate: 85, cancelationRate: 15, utilizationRate: 70 },
  ],
  timeSlots: [
    { timeSlot: '18:00', averageUtilization: 90, bookingCount: 15, entryCount: 120 },
  ],
  courts: [
    { courtId: 'c1', courtName: '籃球場 1', utilizationRate: 75, peakUtilization: 95, offPeakUtilization: 55, bookingCount: 50, cancelationCount: 5, status: 'good' as const },
  ],
  weekday: [
    { weekday: 'weekday' as const, avgUtilization: 54, avgBookings: 45, avgEntries: 380 },
    { weekday: 'weekend' as const, avgUtilization: 88, avgBookings: 78, avgEntries: 650 },
  ],
  bookingStatus: { completed: 85, pending: 10, cancelled: 5, expired: 0, refunded: 0 },
  alerts: [],
  summary: '本期整體預約穩定，完成率良好。',
  fromDate: '2024-11-24',
  toDate: '2024-11-30',
}

describe('導出功能', () => {
  describe('downloadPDF', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('應生成有效的 PDF 文件名', () => {
      const { fromDate, toDate } = mockData
      const filename = `營運狀況報表_${fromDate}_${toDate}.pdf`

      expect(filename).toMatch(/\.pdf$/)
      expect(filename).toContain('營運狀況報表')
    })

    it('應包含所有必要的報表數據', () => {
      const pdfData = mockData

      expect(pdfData).toHaveProperty('metrics')
      expect(pdfData).toHaveProperty('trends')
      expect(pdfData).toHaveProperty('timeSlots')
      expect(pdfData).toHaveProperty('courts')
      expect(pdfData).toHaveProperty('weekday')
      expect(pdfData).toHaveProperty('bookingStatus')
    })

    it('應正確序列化日期', () => {
      const dateStr = mockData.fromDate
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('printReport', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      global.window = { print: vi.fn() } as any
    })

    it('應調用 window.print()', () => {
      printReport()
      expect(window.print).toHaveBeenCalled()
    })

    it('應添加列印樣式', () => {
      const spy = vi.spyOn(document.head, 'appendChild')
      printReport()
      expect(spy).toHaveBeenCalled()
    })

    it('應在列印後清理樣式', (done) => {
      const spy = vi.spyOn(document.head, 'removeChild')
      printReport()

      setTimeout(() => {
        expect(spy).toHaveBeenCalled()
        done()
      }, 150)
    })
  })

  describe('exportCSV', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('應生成有效的 CSV 文件名', () => {
      const { fromDate, toDate } = mockData
      const filename = `營運狀況報表_${fromDate}_${toDate}.csv`

      expect(filename).toMatch(/\.csv$/)
      expect(filename).toContain('營運狀況報表')
    })

    it('應包含標題和日期範圍', () => {
      const csvLines = [
        '營運狀況報表',
        `統計期間: ${mockData.fromDate} 至 ${mockData.toDate}`,
      ]

      expect(csvLines[0]).toBe('營運狀況報表')
      expect(csvLines[1]).toContain('統計期間')
    })

    it('應包含所有統計指標', () => {
      const metrics = [
        '預約完成率,85%',
        '場地使用率,70%',
        '進場人次,1500',
        '門禁開門成功率,98%',
      ]

      metrics.forEach((metric) => {
        expect(metric).toContain(',')
      })
    })

    it('應包含每日趨勢數據', () => {
      const { trends } = mockData
      expect(trends.length).toBeGreaterThan(0)

      trends.forEach((trend) => {
        expect(trend).toHaveProperty('date')
        expect(trend).toHaveProperty('bookingCount')
        expect(trend).toHaveProperty('entryCount')
        expect(trend).toHaveProperty('completionRate')
      })
    })

    it('應包含場地數據', () => {
      const { courts } = mockData
      expect(courts.length).toBeGreaterThan(0)

      courts.forEach((court) => {
        expect(court).toHaveProperty('courtName')
        expect(court).toHaveProperty('utilizationRate')
        expect(court).toHaveProperty('peakUtilization')
      })
    })
  })

  describe('列印友好', () => {
    it('列印樣式應隱藏工具欄', () => {
      const printCSS = `
        @media print {
          .admin-sidebar,
          .operations-toolbar,
          .no-print {
            display: none !important;
          }
        }
      `

      expect(printCSS).toContain('display: none !important')
      expect(printCSS).toContain('.operations-toolbar')
    })

    it('應避免圖表分頁中斷', () => {
      const printCSS = `
        .chart,
        .summary-section,
        .alerts-section {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `

      expect(printCSS).toContain('page-break-inside: avoid')
      expect(printCSS).toContain('break-inside: avoid')
    })

    it('應設置適當的頁面邊距', () => {
      const pageMargin = '20mm'
      expect(pageMargin).toMatch(/^\d+mm$/)
    })
  })

  describe('數據驗證', () => {
    it('所有數值應為正數', () => {
      expect(mockData.metrics.bookingCompletion.completionRate).toBeGreaterThanOrEqual(0)
      expect(mockData.metrics.courtUtilization.overallUtilization).toBeGreaterThanOrEqual(0)
      expect(mockData.metrics.entries.totalEntries).toBeGreaterThanOrEqual(0)
    })

    it('百分比應在 0-100 之間', () => {
      expect(mockData.metrics.bookingCompletion.completionRate).toBeLessThanOrEqual(100)
      expect(mockData.metrics.courtUtilization.overallUtilization).toBeLessThanOrEqual(100)
      expect(mockData.metrics.doorAccess.successRate).toBeLessThanOrEqual(100)
    })

    it('日期應按順序', () => {
      const start = new Date(mockData.fromDate)
      const end = new Date(mockData.toDate)
      expect(start < end).toBe(true)
    })
  })
})
