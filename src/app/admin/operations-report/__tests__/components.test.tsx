import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricsCards } from '../components/metrics-cards'
import { BookingStatusChart } from '../components/booking-status'

const mockMetrics = {
  bookingCompletion: {
    completionRate: 85,
    totalBookings: 100,
    completedBookings: 85,
    cancelledBookings: 10,
    expiredBookings: 5,
    changePercent: 5,
  },
  courtUtilization: {
    overallUtilization: 70,
    peakUtilization: 90,
    offPeakUtilization: 50,
    totalSlots: 1000,
    bookedSlots: 700,
    changePercent: 3,
  },
  entries: {
    totalEntries: 1500,
    averagePerDay: 214,
    changePercent: 8,
    dailyBreakdown: [],
  },
  doorAccess: {
    successRate: 98,
    successCount: 980,
    failureCount: 20,
    totalAttempts: 1000,
    changePercent: 2,
    lastUpdated: new Date(),
    hasData: true,
  },
  timestamp: new Date(),
}

const mockBookingStatus = {
  completed: 85,
  pending: 10,
  cancelled: 5,
  expired: 0,
  refunded: 0,
}

describe('操作報表組件', () => {
  describe('MetricsCards', () => {
    it('應顯示預約完成率', () => {
      render(<MetricsCards metrics={mockMetrics} />)
      expect(screen.getByText('85%')).toBeInTheDocument()
      expect(screen.getByText('預約完成率')).toBeInTheDocument()
    })

    it('應顯示場地使用率', () => {
      render(<MetricsCards metrics={mockMetrics} />)
      expect(screen.getByText('70%')).toBeInTheDocument()
      expect(screen.getByText('場地使用率')).toBeInTheDocument()
    })

    it('應顯示進場人次', () => {
      render(<MetricsCards metrics={mockMetrics} />)
      expect(screen.getByText('1500')).toBeInTheDocument()
      expect(screen.getByText('進場人次')).toBeInTheDocument()
    })

    it('應顯示門禁成功率', () => {
      render(<MetricsCards metrics={mockMetrics} />)
      expect(screen.getByText('98%')).toBeInTheDocument()
      expect(screen.getByText('門禁開門成功率')).toBeInTheDocument()
    })
  })

  describe('BookingStatusChart', () => {
    it('應正確渲染預約狀態圖表', () => {
      render(<BookingStatusChart bookingStatus={mockBookingStatus} />)
      expect(screen.getByText('預約狀態分布')).toBeInTheDocument()
    })

    it('應顯示總預約數', () => {
      render(<BookingStatusChart bookingStatus={mockBookingStatus} />)
      const total = mockBookingStatus.completed + mockBookingStatus.pending + mockBookingStatus.cancelled
      expect(screen.getByText(String(total))).toBeInTheDocument()
    })

    it('應返回空值當沒有預約數據', () => {
      const emptyStatus = { completed: 0, pending: 0, cancelled: 0, expired: 0, refunded: 0 }
      const { container } = render(<BookingStatusChart bookingStatus={emptyStatus} />)
      expect(container.firstChild).toBeNull()
    })
  })
})
