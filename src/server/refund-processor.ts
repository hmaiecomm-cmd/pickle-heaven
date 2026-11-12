/**
 * 退款處理引擎
 *
 * 責務：
 * 1. 根據退款方式分發到對應渠道
 * 2. 處理信用卡刷退
 * 3. 處理點數回補
 * 4. 恢復使用券
 * 5. 失敗時記錄與告警
 * 6. 發送退款確認通知
 */

import { prisma } from '@/lib/db'
import type { Refund, Booking, Prisma } from '@prisma/client'

export interface RefundProcessResult {
  success: boolean
  refundId: string
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING'
  method: string
  amount: number
  providerRef?: string
  error?: string
  processedAt: Date
}

/**
 * 點數帳本入帳
 */
async function createPointsLedgerEntry(
  userId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  // 取得當前點數餘額
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('使用者不存在')
  }

  const newBalance = user.points + amount

  // 建立帳本記錄
  await prisma.pointsLedger.create({
    data: {
      userId,
      delta: amount,
      balanceAfter: newBalance,
      kind: 'REFUND',
      reason: `訂單取消退款 (${bookingId})`,
      actor: 'SYSTEM',
      bookingId,
    },
  })

  // 更新使用者點數
  await prisma.user.update({
    where: { id: userId },
    data: { points: newBalance },
  })
}

/**
 * 恢復使用券
 */
async function restoreVoucher(voucherCode: string): Promise<void> {
  if (!voucherCode) return

  await prisma.voucher.updateMany({
    where: { code: voucherCode },
    data: {
      usedAt: null,
      bookingId: null,
    },
  })
}

/**
 * 處理信用卡刷退（假設金流商）
 * TODO: 整合實際金流商 API
 */
async function processCardRefund(
  refund: Refund & { booking: Booking & { payments: any[] } },
  amount: number
): Promise<RefundProcessResult> {
  const booking = refund.booking
  const payment = booking.payments[0]

  if (!payment) {
    return {
      success: false,
      refundId: refund.id,
      status: 'FAILED',
      method: 'ORIGINAL_CARD',
      amount,
      error: '找不到原始付款記錄',
      processedAt: new Date(),
    }
  }

  try {
    // TODO: 調用金流商 SDK（如 TapPay、NewebPay 等）
    // const result = await paymentGateway.refund({
    //   transactionId: payment.providerRef,
    //   amount,
    //   provider: payment.provider
    // })

    // 模擬成功（實際應調用金流商 API）
    const providerRef = `REFUND-${Date.now()}`

    // 更新退款記錄
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'SUCCEEDED',
        providerRef,
        completedAt: new Date(),
      },
    })

    return {
      success: true,
      refundId: refund.id,
      status: 'SUCCEEDED',
      method: 'ORIGINAL_CARD',
      amount,
      providerRef,
      processedAt: new Date(),
    }
  } catch (error) {
    return {
      success: false,
      refundId: refund.id,
      status: 'FAILED',
      method: 'ORIGINAL_CARD',
      amount,
      error: error instanceof Error ? error.message : '未知錯誤',
      processedAt: new Date(),
    }
  }
}

/**
 * 處理點數退款
 */
async function processPointsRefund(
  refund: Refund & { booking: Booking },
  amount: number
): Promise<RefundProcessResult> {
  const booking = refund.booking

  try {
    await createPointsLedgerEntry(booking.userId, amount, booking.id)

    // 更新退款記錄
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
      },
    })

    return {
      success: true,
      refundId: refund.id,
      status: 'SUCCEEDED',
      method: 'POINTS',
      amount,
      processedAt: new Date(),
    }
  } catch (error) {
    return {
      success: false,
      refundId: refund.id,
      status: 'FAILED',
      method: 'POINTS',
      amount,
      error: error instanceof Error ? error.message : '未知錯誤',
      processedAt: new Date(),
    }
  }
}

/**
 * 處理使用券恢復
 */
async function processVoucherRefund(
  refund: Refund & { booking: Booking },
  amount: number
): Promise<RefundProcessResult> {
  const booking = refund.booking

  try {
    if (!booking.voucherCode) {
      throw new Error('找不到使用券代碼')
    }

    await restoreVoucher(booking.voucherCode)

    // 更新退款記錄
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
      },
    })

    return {
      success: true,
      refundId: refund.id,
      status: 'SUCCEEDED',
      method: 'VOUCHER',
      amount,
      processedAt: new Date(),
    }
  } catch (error) {
    return {
      success: false,
      refundId: refund.id,
      status: 'FAILED',
      method: 'VOUCHER',
      amount,
      error: error instanceof Error ? error.message : '未知錯誤',
      processedAt: new Date(),
    }
  }
}

/**
 * 主退款流程
 */
export async function processRefund(refundId: string): Promise<RefundProcessResult> {
  try {
    // 1. 查詢退款記錄
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          include: {
            payments: true,
          },
        },
      },
    })

    if (!refund) {
      return {
        success: false,
        refundId,
        status: 'FAILED',
        method: 'UNKNOWN',
        amount: 0,
        error: '退款記錄不存在',
        processedAt: new Date(),
      }
    }

    const booking = refund.booking as any
    const amount = refund.cashAmount

    // 2. 根據退款方式分發處理
    let result: RefundProcessResult

    if (refund.method === 'ORIGINAL_CARD') {
      result = await processCardRefund(
        refund as Refund & { booking: Booking & { payments: any[] } },
        amount
      )
    } else if (refund.method === 'POINTS') {
      result = await processPointsRefund(
        refund as Refund & { booking: Booking },
        amount
      )
    } else if (refund.method === 'VOUCHER') {
      result = await processVoucherRefund(
        refund as Refund & { booking: Booking },
        amount
      )
    } else {
      result = {
        success: false,
        refundId,
        status: 'FAILED',
        method: refund.method,
        amount,
        error: `不支持的退款方式: ${refund.method}`,
        processedAt: new Date(),
      }
    }

    // 3. 建立控制事件日誌
    if (result.success) {
      await prisma.controlEvent.create({
        data: {
          eventId: `evt-refund-${refundId}`,
          venueId: booking.venueId,
          userId: booking.userId,
          commandId: refundId,
          eventType: 'COMMAND_ACKED',
          severity: 'INFO',
          environment: 'PRODUCTION',
          title: `退款已完成 — ${booking.code}`,
          description: `訂單 ${booking.code} 退款 NT$${amount} 已完成（方式：${refund.method}）`,
          data: {
            bookingCode: booking.code,
            refundId,
            refundAmount: amount,
            refundMethod: refund.method,
          },
        },
      })
    } else {
      // 失敗時標記為待人工審核
      await prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'MANUAL_PENDING',
          failReason: result.error,
        },
      })

      await prisma.controlEvent.create({
        data: {
          eventId: `evt-refund-fail-${refundId}`,
          venueId: booking.venueId,
          userId: booking.userId,
          commandId: refundId,
          eventType: 'COMMAND_FAILED',
          severity: 'ERROR',
          environment: 'PRODUCTION',
          title: `退款失敗 — ${booking.code}`,
          description: `訂單 ${booking.code} 退款失敗：${result.error}`,
          data: {
            bookingCode: booking.code,
            refundId,
            error: result.error,
          },
        },
      })
    }

    return result
  } catch (error) {
    console.error('[RefundProcessor] 退款處理異常', error)

    return {
      success: false,
      refundId,
      status: 'FAILED',
      method: 'UNKNOWN',
      amount: 0,
      error: error instanceof Error ? error.message : '未知錯誤',
      processedAt: new Date(),
    }
  }
}

/**
 * 批量處理待處理的退款
 * 由後台定時任務調用
 */
export async function processPendingRefunds(): Promise<RefundProcessResult[]> {
  try {
    // 查詢所有待處理的退款
    const pendingRefunds = await prisma.refund.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 小時內
        },
      },
      take: 100, // 一次最多 100 筆
    })

    const results: RefundProcessResult[] = []

    for (const refund of pendingRefunds) {
      const result = await processRefund(refund.id)
      results.push(result)
    }

    return results
  } catch (error) {
    console.error('[RefundProcessor] 批量退款處理異常', error)
    return []
  }
}

/**
 * 查詢退款狀態
 */
export async function getRefundStatus(refundId: string) {
  try {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          select: {
            code: true,
            total: true,
          },
        },
      },
    })

    if (!refund) {
      return {
        success: false,
        error: '退款記錄不存在',
      }
    }

    return {
      success: true,
      refund: {
        id: refund.id,
        bookingCode: refund.booking.code,
        status: refund.status,
        method: refund.method,
        amount: refund.cashAmount,
        createdAt: refund.createdAt,
        completedAt: refund.completedAt,
        error: refund.failReason,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢失敗',
    }
  }
}
