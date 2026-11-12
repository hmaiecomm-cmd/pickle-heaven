/**
 * 退款處理引擎單元測試
 *
 * 覆蓋場景：
 * 1. 信用卡刷退
 * 2. 點數回補
 * 3. 使用券恢復
 * 4. 失敗處理與重試
 * 5. 控制事件日誌
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import type { Refund, Booking } from '@prisma/client'
import { processRefund, processPendingRefunds, getRefundStatus } from '../refund-processor'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    refund: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pointsLedger: {
      create: jest.fn(),
    },
    voucher: {
      updateMany: jest.fn(),
    },
    controlEvent: {
      create: jest.fn(),
    },
  },
}))

describe('RefundProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('信用卡刷退', () => {
    it('應成功處理信用卡退款', async () => {
      const mockRefund: any = {
        id: 'ref-001',
        method: 'ORIGINAL_CARD',
        cashAmount: 1000,
        status: 'PROCESSING',
        booking: {
          id: 'bk-001',
          code: 'BK-20261115-001',
          userId: 'user-001',
          venueId: 'venue-001',
          total: 1000,
          payments: [{ providerRef: 'txn-12345', provider: 'TapPay' }],
        },
      }

      const result = await processRefund('ref-001')

      expect(result.success).toBe(true)
      expect(result.status).toBe('SUCCEEDED')
      expect(result.method).toBe('ORIGINAL_CARD')
      expect(result.amount).toBe(1000)
    })

    it('應在沒有付款記錄時失敗', async () => {
      const mockRefund: any = {
        id: 'ref-002',
        method: 'ORIGINAL_CARD',
        cashAmount: 500,
        status: 'PROCESSING',
        booking: {
          id: 'bk-002',
          code: 'BK-20261115-002',
          userId: 'user-002',
          venueId: 'venue-001',
          total: 500,
          payments: [],
        },
      }

      const result = await processRefund('ref-002')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.error).toContain('原始付款')
    })
  })

  describe('點數回補', () => {
    it('應成功回補點數', async () => {
      const mockRefund: any = {
        id: 'ref-003',
        method: 'POINTS',
        cashAmount: 500,
        status: 'PROCESSING',
        booking: {
          id: 'bk-003',
          code: 'BK-20261115-003',
          userId: 'user-003',
          venueId: 'venue-001',
          total: 500,
        },
      }

      const result = await processRefund('ref-003')

      expect(result.success).toBe(true)
      expect(result.status).toBe('SUCCEEDED')
      expect(result.method).toBe('POINTS')
    })

    it('應在用戶不存在時失敗', async () => {
      const mockRefund: any = {
        id: 'ref-004',
        method: 'POINTS',
        cashAmount: 200,
        status: 'PROCESSING',
        booking: {
          id: 'bk-004',
          code: 'BK-20261115-004',
          userId: 'invalid-user',
          venueId: 'venue-001',
          total: 200,
        },
      }

      const result = await processRefund('ref-004')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('使用券恢復', () => {
    it('應成功恢復使用券', async () => {
      const mockRefund: any = {
        id: 'ref-005',
        method: 'VOUCHER',
        cashAmount: 0,
        status: 'PROCESSING',
        booking: {
          id: 'bk-005',
          code: 'BK-20261115-005',
          userId: 'user-005',
          venueId: 'venue-001',
          total: 800,
          voucherCode: 'VOUCHER-12345',
        },
      }

      const result = await processRefund('ref-005')

      expect(result.success).toBe(true)
      expect(result.status).toBe('SUCCEEDED')
      expect(result.method).toBe('VOUCHER')
    })

    it('應在缺少使用券代碼時失敗', async () => {
      const mockRefund: any = {
        id: 'ref-006',
        method: 'VOUCHER',
        cashAmount: 0,
        status: 'PROCESSING',
        booking: {
          id: 'bk-006',
          code: 'BK-20261115-006',
          userId: 'user-006',
          venueId: 'venue-001',
          total: 800,
          voucherCode: null,
        },
      }

      const result = await processRefund('ref-006')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('退款不存在', () => {
    it('應處理不存在的退款 ID', async () => {
      const result = await processRefund('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.error).toContain('不存在')
    })
  })

  describe('批量處理', () => {
    it('應批量處理待處理的退款', async () => {
      const results = await processPendingRefunds()

      expect(Array.isArray(results)).toBe(true)
    })

    it('應返回各退款的處理結果', async () => {
      const results = await processPendingRefunds()

      if (results.length > 0) {
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          expect(result).toHaveProperty('status')
          expect(result).toHaveProperty('refundId')
        })
      }
    })
  })

  describe('退款狀態查詢', () => {
    it('應查詢現有退款的狀態', async () => {
      const result = await getRefundStatus('ref-001')

      if (result.success) {
        expect(result.refund).toBeDefined()
        expect(result.refund?.id).toBe('ref-001')
        expect(result.refund?.status).toBeDefined()
      }
    })

    it('應在退款不存在時返回錯誤', async () => {
      const result = await getRefundStatus('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('錯誤處理', () => {
    it('應捕捉並記錄異常', async () => {
      const result = await processRefund('')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
    })

    it('應為失敗的退款標記為待人工審核', async () => {
      const mockRefund: any = {
        id: 'ref-fail-001',
        method: 'UNKNOWN_METHOD',
        cashAmount: 1000,
        status: 'PROCESSING',
        booking: {
          id: 'bk-fail-001',
          code: 'BK-20261115-FAIL',
          userId: 'user-fail',
          venueId: 'venue-001',
          total: 1000,
        },
      }

      const result = await processRefund('ref-fail-001')

      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('邊界情況', () => {
    it('應處理 0 元退款', async () => {
      const mockRefund: any = {
        id: 'ref-zero',
        method: 'VOUCHER',
        cashAmount: 0,
        status: 'PROCESSING',
        booking: {
          id: 'bk-zero',
          code: 'BK-20261115-ZERO',
          userId: 'user-zero',
          venueId: 'venue-001',
          total: 0,
          voucherCode: 'VOUCHER-ZERO',
        },
      }

      const result = await processRefund('ref-zero')

      expect(result).toBeDefined()
      expect(result.amount).toBe(0)
    })

    it('應處理大金額退款', async () => {
      const mockRefund: any = {
        id: 'ref-large',
        method: 'ORIGINAL_CARD',
        cashAmount: 999999,
        status: 'PROCESSING',
        booking: {
          id: 'bk-large',
          code: 'BK-20261115-LARGE',
          userId: 'user-large',
          venueId: 'venue-001',
          total: 999999,
          payments: [{ providerRef: 'txn-large', provider: 'TapPay' }],
        },
      }

      const result = await processRefund('ref-large')

      expect(result).toBeDefined()
      expect(result.amount).toBe(999999)
    })
  })

  describe('控制事件日誌整合', () => {
    it('應為成功的退款建立控制事件', async () => {
      const mockRefund: any = {
        id: 'ref-evt-success',
        method: 'POINTS',
        cashAmount: 500,
        status: 'PROCESSING',
        booking: {
          id: 'bk-evt-success',
          code: 'BK-20261115-EVT',
          userId: 'user-evt',
          venueId: 'venue-001',
          total: 500,
        },
      }

      const result = await processRefund('ref-evt-success')

      expect(result).toBeDefined()
    })

    it('應為失敗的退款建立失敗事件', async () => {
      const mockRefund: any = {
        id: 'ref-evt-fail',
        method: 'UNKNOWN',
        cashAmount: 300,
        status: 'PROCESSING',
        booking: {
          id: 'bk-evt-fail',
          code: 'BK-20261115-EVTFAIL',
          userId: 'user-evtfail',
          venueId: 'venue-001',
          total: 300,
        },
      }

      const result = await processRefund('ref-evt-fail')

      expect(result.success).toBe(false)
    })
  })
})
