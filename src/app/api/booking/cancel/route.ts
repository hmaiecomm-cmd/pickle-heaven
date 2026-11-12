/**
 * POST /api/booking/cancel
 *
 * 訂單取消 API
 *
 * 要求：
 * - 必須驗證使用者身份
 * - 檢查訂單歸屬權
 * - 評估退款資格
 * - 建立取消日誌與退款記錄
 * - 釋放時段佔用
 * - 發送通知
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { RefundRuleEngine, getPlayDateTime } from '@/lib/refund-rule-engine'
import { differenceInMinutes, parseISO } from 'date-fns'

interface CancelRequest {
  bookingId: string
}

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ 驗證使用者身份
    const userId = (await getSessionUser())?.id
    if (!userId) {
      return NextResponse.json(
        { error: '未授權' },
        { status: 401 }
      )
    }

    // 2️⃣ 解析請求
    const body: CancelRequest = await req.json()
    const { bookingId } = body

    if (!bookingId) {
      return NextResponse.json(
        { error: '缺失 bookingId' },
        { status: 400 }
      )
    }

    // 3️⃣ 查詢訂單
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        venue: true,
        items: true,
        reservations: true,
        refunds: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: '訂單不存在' },
        { status: 404 }
      )
    }

    // 4️⃣ 驗證權限
    if (booking.userId !== userId) {
      return NextResponse.json(
        { error: '無權限操作此訂單' },
        { status: 403 }
      )
    }

    // 5️⃣ 檢查訂單狀態
    if (booking.status !== 'PAID') {
      return NextResponse.json(
        {
          error: '只有已付款訂單才能取消',
          currentStatus: booking.status,
        },
        { status: 400 }
      )
    }

    // 6️⃣ 計算開打時間
    let playDateTime: Date

    try {
      // 從第一個訂單項目取開始時間
      if (booking.items.length === 0) {
        return NextResponse.json(
          { error: '訂單無項目信息' },
          { status: 400 }
        )
      }

      playDateTime = new Date(booking.items[0].startsAt)
    } catch (error) {
      return NextResponse.json(
        { error: '無法計算開打時間' },
        { status: 400 }
      )
    }

    // 7️⃣ 評估退款資格
    const eligibility = RefundRuleEngine.evaluateEligibility({
      booking,
      playDateTime,
      currentDateTime: new Date(),
      isCheckedIn: !!booking.checkedInAt,
      venue: booking.venue,
    })

    // 8️⃣ 檢查是否允許自助取消
    if (!eligibility.canSelfCancel) {
      return NextResponse.json(
        {
          error: eligibility.message,
          scenario: eligibility.scenario,
          requiresManualReview: eligibility.requiresManualReview,
        },
        { status: 403 }
      )
    }

    // 9️⃣ 建立取消日誌
    await prisma.cancellationLog.create({
      data: {
        bookingId: booking.id,
        status: 'SUCCESS',
        minutesBeforeStart: differenceInMinutes(playDateTime, new Date()),
        operatedBy: 'USER',
      },
    })

    // 🔟 建立退款記錄
    const refund = await prisma.refund.create({
      data: {
        bookingId: booking.id,
        idempotencyKey: `cancel-${booking.id}-${Date.now()}`,
        status: 'PROCESSING',
        method: eligibility.refundMethod,
        cashAmount: eligibility.actualRefundAmount,
        pointsAmount:
          eligibility.refundMethod === 'POINTS'
            ? eligibility.actualRefundAmount
            : 0,
        reason: '使用者自助取消',
        cancelItems: true,
        createdBy: userId,
        fullRefundEligible: eligibility.scenario === 'FULL_REFUND',
        isLateRefund: false,
        actualCancelledAt: new Date(),
        cancelDeadlineAt: eligibility.cancelDeadlineAt,
        refundBreakdown: {
          scenarioType: eligibility.scenario,
          reason: eligibility.message,
          originalAmount: booking.total,
          refundAmount: eligibility.actualRefundAmount,
          refundMethod: eligibility.refundMethod,
          timeline: {
            bookingCreatedAt: booking.createdAt.toISOString(),
            playDateTime: playDateTime.toISOString(),
            cancelledAt: new Date().toISOString(),
            minutesBeforeCancelDeadline:
              eligibility.minutesBeforeCancelDeadline,
          },
        },
      },
    })

    // 1️⃣1️⃣ 更新訂單狀態
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        lastCancelAttempt: new Date(),
        refundEligible: eligibility.scenario === 'FULL_REFUND',
      },
    })

    // 1️⃣2️⃣ 釋放時段（刪除 Reservation）
    await prisma.reservation.deleteMany({
      where: { bookingId: booking.id },
    })

    // 1️⃣3️⃣ 發送通知（非同步，不阻塞回應）
    // TODO: 調用通知服務（LINE、Email）
    // sendCancellationNotification(booking, refund, eligibility).catch(err => {
    //   logger.error('通知發送失敗', err)
    // })

    // 1️⃣4️⃣ 發起退款流程（非同步）
    // TODO: 調用退款處理服務
    // processRefund(refund.id, eligibility).catch(err => {
    //   logger.error('退款處理失敗', err)
    // })

    // 1️⃣5️⃣ 建立控制事件日誌
    await prisma.controlEvent.create({
      data: {
        eventId: `evt-${refund.id}`,
        venueId: booking.venueId,
        userId: booking.userId,
        commandId: refund.id,
        eventType: 'RESERVATION_CANCELLED',
        severity: 'INFO',
        environment: 'PRODUCTION',
        title: `訂單已取消 — ${booking.code}`,
        description: `訂單 ${booking.code} 已取消，申請退款 NT$${eligibility.actualRefundAmount}`,
        data: {
          bookingCode: booking.code,
          refundId: refund.id,
          refundAmount: eligibility.actualRefundAmount,
          refundMethod: eligibility.refundMethod,
        },
      },
    })

    // ✅ 成功回應
    return NextResponse.json(
      {
        success: true,
        message: '訂單已成功取消',
        booking: {
          id: booking.id,
          code: booking.code,
          status: 'CANCELLED',
        },
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refund.cashAmount,
          method: refund.method,
          estimatedProcessingDays: eligibility.estimatedProcessingDays,
        },
        eligibility: {
          scenario: eligibility.scenario,
          refundAmount: eligibility.actualRefundAmount,
          refundMethod: eligibility.refundMethod,
          message: eligibility.message,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[API] 取消訂單失敗', error)

    return NextResponse.json(
      {
        error: '取消訂單失敗，請稍後重試或聯繫客服',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    )
  }
}

/**
 * 型別定義：取消 API 的回應格式
 */
export interface CancelBookingResponse {
  success: boolean
  message?: string
  error?: string
  booking?: {
    id: string
    code: string
    status: string
  }
  refund?: {
    id: string
    status: string
    amount: number
    method: string
    estimatedProcessingDays: number
  }
  eligibility?: {
    scenario: string
    refundAmount: number
    refundMethod: string
    message: string
  }
}
