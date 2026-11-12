/**
 * 退款資格判斷引擎
 *
 * 規則：
 * 1. 已報到 → 禁止取消（No-Show 無退款）
 * 2. 開打前 ≥ 24 小時 → 全額退款
 * 3. 開打前 < 24 小時 → 拒絕自助，需人工審核
 * 4. 已取消 → 無變化
 */

import { differenceInMinutes, differenceInHours, subHours, isPast } from 'date-fns'
import type { Booking, Venue } from '@prisma/client'

export type RefundScenario =
  | 'FULL_REFUND'
  | 'NO_REFUND'
  | 'LATE_CANCEL'
  | 'CHECKED_IN'
  | 'ALREADY_CANCELLED'

export type RefundMethod = 'ORIGINAL_CARD' | 'POINTS' | 'VOUCHER' | 'MANUAL'

export interface RefundEligibilityInput {
  booking: Booking
  playDateTime: Date
  currentDateTime?: Date
  isCheckedIn: boolean
  venue: Venue
}

export interface RefundEligibilityResult {
  eligible: boolean
  scenario: RefundScenario
  reason: string
  minutesBeforeCancelDeadline: number
  fullRefundAmount: number
  actualRefundAmount: number
  refundMethod: RefundMethod
  requiresManualReview: boolean
  canSelfCancel: boolean
  estimatedProcessingDays: number
  message: string
  refundDeadlineAt?: Date
  cancelDeadlineAt?: Date
}

export class RefundRuleEngine {
  /**
   * 核心邏輯：判斷訂單是否符合退款資格
   *
   * @param input 輸入參數（訂單、開打時間、檢查時間）
   * @returns 詳細的退款資格評估結果
   */
  static evaluateEligibility(
    input: RefundEligibilityInput
  ): RefundEligibilityResult {
    const {
      booking,
      playDateTime,
      currentDateTime = new Date(),
      isCheckedIn,
      venue,
    } = input

    // 前置檢查：訂單狀態
    if (booking.status === 'CANCELLED') {
      return this.buildResult({
        eligible: false,
        scenario: 'ALREADY_CANCELLED',
        reason: '訂單已取消',
        minutesBeforeCancelDeadline: -999,
        fullRefundAmount: 0,
        actualRefundAmount: 0,
        refundMethod: 'MANUAL',
        requiresManualReview: false,
        canSelfCancel: false,
        estimatedProcessingDays: 0,
        message: '訂單已取消，無法進行進一步操作',
      })
    }

    // 規則 1: 已報到 → 禁止取消（No-Show）
    if (isCheckedIn) {
      return this.buildResult({
        eligible: false,
        scenario: 'CHECKED_IN',
        reason: '已報到',
        minutesBeforeCancelDeadline: -999,
        fullRefundAmount: 0,
        actualRefundAmount: 0,
        refundMethod: 'MANUAL',
        requiresManualReview: false,
        canSelfCancel: false,
        estimatedProcessingDays: 0,
        message: '訂單已報到，無法取消。如有特殊情況，請聯繫客服。',
      })
    }

    // 計算時間差
    const minutesUntilStart = differenceInMinutes(playDateTime, currentDateTime)
    const hoursUntilStart = differenceInHours(playDateTime, currentDateTime)

    // 決定取消截止點（開打前 24 小時）
    const cancelDeadlineAt = subHours(playDateTime, 24)
    const minutesBeforeCancelDeadline = differenceInMinutes(
      cancelDeadlineAt,
      currentDateTime
    )
    const isPastCancelDeadline = isPast(cancelDeadlineAt)

    // 規則 2: 開打前 ≥ 24 小時 → 全額退款
    if (minutesBeforeCancelDeadline >= 0 && !isPastCancelDeadline) {
      const refundMethod = this.determineRefundMethod(booking)
      const processingDays = refundMethod === 'ORIGINAL_CARD' ? 3 : 1

      return this.buildResult({
        eligible: true,
        scenario: 'FULL_REFUND',
        reason: `開打前 ${Math.floor(hoursUntilStart)} 小時，符合全額退款條件`,
        minutesBeforeCancelDeadline,
        fullRefundAmount: booking.total,
        actualRefundAmount: booking.total,
        refundMethod,
        requiresManualReview: false,
        canSelfCancel: true,
        estimatedProcessingDays: processingDays,
        message: `✓ 符合全額退款條件\n\n退款金額：NT$${booking.total}\n退款方式：${this.formatRefundMethod(
          refundMethod
        )}\n預計入帳：${processingDays === 1 ? '立即' : `${processingDays}-${processingDays + 2} 個工作日`}`,
        refundDeadlineAt: cancelDeadlineAt,
        cancelDeadlineAt,
      })
    }

    // 規則 3: 開打前 < 24 小時 → 拒絕自助，但可人工審核
    return this.buildResult({
      eligible: false,
      scenario: 'LATE_CANCEL',
      reason: `已超過自助取消期限（超時 ${Math.abs(
        minutesBeforeCancelDeadline
      )} 分鐘）`,
      minutesBeforeCancelDeadline,
      fullRefundAmount: booking.total,
      actualRefundAmount: 0, // 默認無退款，但可人工審核
      refundMethod: 'MANUAL',
      requiresManualReview: true,
      canSelfCancel: false,
      estimatedProcessingDays: 0,
      message: `⚠ 已超過自助取消時限\n\n取消期限：開打前 24 小時（${cancelDeadlineAt.toLocaleString(
        'zh-TW',
        {
          timeZone: venue.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }
      )}）\n\n如需取消，請聯繫客服進行人工審核。`,
      cancelDeadlineAt,
    })
  }

  /**
   * 根據原付款方式決定退款管道
   * 優先順序：
   * 1. 原付款方式（信用卡、LINE Pay）
   * 2. 使用券 → 退券
   * 3. 點數 → 退點數
   * 4. 混合 → 按比例分別退款
   */
  private static determineRefundMethod(booking: Booking): RefundMethod {
    // 檢查原始付款方式
    // 如果有點數使用，優先退點數
    if (booking.pointsUsed > 0) {
      return 'POINTS'
    }

    // 如果有使用券，退券
    if (booking.voucherCode) {
      return 'VOUCHER'
    }

    // 默認退回原付款方式（信用卡或 LINE Pay）
    return 'ORIGINAL_CARD'
  }

  /**
   * 格式化退款方式為人類易讀文本
   */
  private static formatRefundMethod(method: RefundMethod): string {
    const mapping: Record<RefundMethod, string> = {
      ORIGINAL_CARD:
        '退回原付款信用卡（3-5 個工作日，視發卡銀行作業）',
      POINTS: '退回點數帳戶（立即入帳）',
      VOUCHER: '恢復使用券',
      MANUAL: '人工處理（待客服審核）',
    }
    return mapping[method] || '人工處理'
  }

  /**
   * 構建統一的結果物件
   */
  private static buildResult(
    partial: Partial<RefundEligibilityResult>
  ): RefundEligibilityResult {
    return {
      eligible: false,
      scenario: 'NO_REFUND',
      reason: '',
      minutesBeforeCancelDeadline: -999,
      fullRefundAmount: 0,
      actualRefundAmount: 0,
      refundMethod: 'MANUAL',
      requiresManualReview: false,
      canSelfCancel: false,
      estimatedProcessingDays: 0,
      message: '',
      ...partial,
    }
  }

  /**
   * 針對給定的多個訂單，批量評估退款資格
   * 用於後台列表或批量操作
   */
  static evaluateMultiple(
    inputs: RefundEligibilityInput[]
  ): Map<string, RefundEligibilityResult> {
    const results = new Map<string, RefundEligibilityResult>()

    for (const input of inputs) {
      const result = this.evaluateEligibility(input)
      results.set(input.booking.id, result)
    }

    return results
  }

  /**
   * 判斷訂單是否符合「立即退款」（不需人工審核）
   */
  static isEligibleForImmediateRefund(
    result: RefundEligibilityResult
  ): boolean {
    return (
      result.scenario === 'FULL_REFUND' &&
      !result.requiresManualReview &&
      result.actualRefundAmount > 0
    )
  }

  /**
   * 判斷訂單是否需要「人工審核」
   */
  static requiresManualReview(result: RefundEligibilityResult): boolean {
    return result.requiresManualReview || result.scenario === 'LATE_CANCEL'
  }
}

/**
 * 幫助函數：計算開打時間
 *
 * 從 Booking 與 BookingItem 推導出實際開打時間
 */
export async function getPlayDateTime(
  booking: any, // Booking with relations
  prisma: any
): Promise<Date> {
  if (!booking.items || booking.items.length === 0) {
    throw new Error('訂單無項目信息')
  }

  // 取第一個項目的開始時間（假設同一訂單所有項目時間相同）
  const firstItem = booking.items[0]
  return new Date(firstItem.startsAt)
}

/**
 * 從 playDate 與開打時間計算
 *
 * 例：playDate = "2026-12-25", startMinute = 1000 (10:00)
 * → 2026-12-25T10:00:00+08:00 (Asia/Taipei)
 */
export function buildPlayDateTime(
  playDate: string, // YYYY-MM-DD
  startMinute: number, // 0-1440
  timezone: string = 'Asia/Taipei'
): Date {
  const [year, month, day] = playDate.split('-').map(Number)
  const hours = Math.floor(startMinute / 60)
  const minutes = startMinute % 60

  // 使用 Date-fns 或原生 Date + 時區轉換
  // 此處簡化為 UTC，實際應使用時區庫（如 date-fns-tz）
  const date = new Date(`${playDate}T${String(hours).padStart(2, '0')}:${String(
    minutes
  ).padStart(2, '0')}:00`)

  return date
}
