/**
 * RefundRuleEngine 單元測試
 *
 * 覆蓋場景：
 * 1. 已報到 → 禁止取消
 * 2. 開打前 ≥ 24 小時 → 全額退款
 * 3. 開打前 < 24 小時 → 拒絕自助，需人工審核
 * 4. 已取消 → 無變化
 * 5. 混合場景（點數、券、卡）
 */

import { describe, it, expect } from '@jest/globals'
import { RefundRuleEngine } from './refund-rule-engine'
import { addHours, subHours, subMinutes } from 'date-fns'

// 模擬 Booking 對象
const createMockBooking = (overrides = {}) => ({
  id: 'booking-001',
  code: 'BK-20261115-001',
  userId: 'user-001',
  venueId: 'venue-001',
  playDate: '2026-11-20',
  status: 'PAID',
  subtotal: 1000,
  discount: 0,
  pointsUsed: 0,
  total: 1000,
  contactName: '張三',
  contactPhone: '0912345678',
  note: null,
  voucherCode: null,
  refundedAmount: 0,
  refundStatus: 'NONE',
  expiresAt: null,
  paidAt: new Date(),
  cancelledAt: null,
  termsAckedAt: new Date(),
  termsVersion: 'v1.0',
  lastCancelAttempt: null,
  cancelAttemptReason: null,
  checkedInAt: null,
  noShowReason: null,
  cancelDeadlineAt: null,
  refundEligible: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const mockVenue = {
  id: 'venue-001',
  slug: 'pickle-heaven',
  name: '匹克天堂',
  timezone: 'Asia/Taipei',
}

describe('RefundRuleEngine', () => {
  describe('已報到訂單', () => {
    it('應拒絕已報到訂單的取消', () => {
      const booking = createMockBooking({
        checkedInAt: new Date(),
      })
      const playDateTime = addHours(new Date(), 2)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: true,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
      expect(result.scenario).toBe('CHECKED_IN')
      expect(result.canSelfCancel).toBe(false)
      expect(result.actualRefundAmount).toBe(0)
    })
  })

  describe('全額退款（開打前 ≥ 24 小時）', () => {
    it('開打前 25 小時應符合全額退款', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 25)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.scenario).toBe('FULL_REFUND')
      expect(result.canSelfCancel).toBe(true)
      expect(result.actualRefundAmount).toBe(booking.total)
      expect(result.requiresManualReview).toBe(false)
    })

    it('開打前 24 小時 0 分應符合全額退款', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 24)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.scenario).toBe('FULL_REFUND')
    })

    it('開打前 48 小時應符合全額退款', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 48)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.scenario).toBe('FULL_REFUND')
      expect(result.actualRefundAmount).toBe(1000)
    })
  })

  describe('超期取消（開打前 < 24 小時）', () => {
    it('開打前 23 小時應拒絕自助取消', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 23)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
      expect(result.scenario).toBe('LATE_CANCEL')
      expect(result.canSelfCancel).toBe(false)
      expect(result.requiresManualReview).toBe(true)
      expect(result.actualRefundAmount).toBe(0)
    })

    it('開打前 1 小時應拒絕自助取消', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 1)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
      expect(result.scenario).toBe('LATE_CANCEL')
      expect(result.requiresManualReview).toBe(true)
    })

    it('開打前 0 分鐘應拒絕自助取消', () => {
      const booking = createMockBooking()
      const playDateTime = new Date()

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
      expect(result.scenario).toBe('LATE_CANCEL')
    })
  })

  describe('已取消訂單', () => {
    it('應拒絕已取消訂單的重新操作', () => {
      const booking = createMockBooking({
        status: 'CANCELLED',
        cancelledAt: new Date(),
      })
      const playDateTime = addHours(new Date(), 48)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
      expect(result.scenario).toBe('ALREADY_CANCELLED')
    })
  })

  describe('退款方式判斷', () => {
    it('有點數使用時應優先退點數', () => {
      const booking = createMockBooking({
        pointsUsed: 200,
      })
      const playDateTime = addHours(new Date(), 25)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.refundMethod).toBe('POINTS')
    })

    it('有使用券時應退券', () => {
      const booking = createMockBooking({
        voucherCode: 'VOUCHER-001',
      })
      const playDateTime = addHours(new Date(), 25)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.refundMethod).toBe('VOUCHER')
    })

    it('無特殊付款時應退原信用卡', () => {
      const booking = createMockBooking({
        pointsUsed: 0,
        voucherCode: null,
      })
      const playDateTime = addHours(new Date(), 25)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
      expect(result.refundMethod).toBe('ORIGINAL_CARD')
    })
  })

  describe('批量評估', () => {
    it('應正確評估多筆訂單', () => {
      const bookings = [
        createMockBooking({ id: 'bk-001' }),
        createMockBooking({ id: 'bk-002' }),
        createMockBooking({ id: 'bk-003', checkedInAt: new Date() }),
      ]

      const inputs = bookings.map((booking) => ({
        booking,
        playDateTime: addHours(new Date(), 25),
        isCheckedIn: !!booking.checkedInAt,
        venue: mockVenue as any,
      }))

      const results = RefundRuleEngine.evaluateMultiple(inputs)

      expect(results.size).toBe(3)
      expect(results.get('bk-001')?.eligible).toBe(true)
      expect(results.get('bk-002')?.eligible).toBe(true)
      expect(results.get('bk-003')?.eligible).toBe(false)
    })
  })

  describe('立即退款判斷', () => {
    it('應正確識別可立即退款的訂單', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 25)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(RefundRuleEngine.isEligibleForImmediateRefund(result)).toBe(true)
    })

    it('超期訂單不應立即退款', () => {
      const booking = createMockBooking()
      const playDateTime = addHours(new Date(), 1)

      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(RefundRuleEngine.isEligibleForImmediateRefund(result)).toBe(false)
    })
  })

  describe('邊界情況', () => {
    it('正好在 24 小時截止點應符合條件', () => {
      const now = new Date()
      const playDateTime = addHours(now, 24)

      const booking = createMockBooking()
      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        currentDateTime: now,
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(true)
    })

    it('超過 24 小時 1 分鐘應拒絕', () => {
      const now = new Date()
      const playDateTime = addHours(now, 24)

      const booking = createMockBooking()
      const result = RefundRuleEngine.evaluateEligibility({
        booking,
        playDateTime,
        currentDateTime: subMinutes(now, -1), // 現在時間 + 1 分鐘
        isCheckedIn: false,
        venue: mockVenue as any,
      })

      expect(result.eligible).toBe(false)
    })
  })
})
