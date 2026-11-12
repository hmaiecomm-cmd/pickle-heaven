'use client'

/**
 * 訂單取消面板
 *
 * 根據退款資格判斷，顯示：
 * - 符合資格：全額退款確認框
 * - 超期取消：人工審核提示
 * - 已報到：無法取消提示
 */

import { useState } from 'react'
import { AlertCircle, AlertTriangle, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { RefundEligibilityResult } from '@/lib/refund-rule-engine'

export interface CancellationPanelProps {
  bookingId: string
  bookingCode: string
  eligibility: RefundEligibilityResult
  onCancelConfirm?: (bookingId: string) => Promise<void>
  onContactSupport?: () => void
}

export function CancellationPanel({
  bookingId,
  bookingCode,
  eligibility,
  onCancelConfirm,
  onContactSupport,
}: CancellationPanelProps) {
  const [isPending, setIsPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = async () => {
    if (!onCancelConfirm) return

    try {
      setIsPending(true)
      await onCancelConfirm(bookingId)
      // 成功後的提示由父元件處理（通常會導航或顯示確認）
    } catch (error) {
      console.error('取消訂單失敗', error)
      // 錯誤提示由父元件或 API 返回處理
    } finally {
      setIsPending(false)
    }
  }

  // ═════════════════════════════════════════════
  // 情景 1：符合全額退款條件
  // ═════════════════════════════════════════════
  if (eligibility.scenario === 'FULL_REFUND' && eligibility.eligible) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Clock className="h-5 w-5" />
                可以取消訂單
              </CardTitle>
              <CardDescription className="text-green-800">
                您符合全額退款條件
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-700">距截止</div>
              <div className="text-lg font-semibold text-green-900">
                {Math.ceil(eligibility.minutesBeforeCancelDeadline / 60)} 小時
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 退款詳情 */}
          <div className="space-y-2 rounded-lg bg-white p-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">訂單金額</span>
              <span className="font-medium">NT${eligibility.fullRefundAmount}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-gray-900">退款金額</span>
              <span className="font-semibold text-green-700">
                NT${eligibility.actualRefundAmount}
              </span>
            </div>
          </div>

          {/* 退款方式 */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">退款方式</div>
            <div className="rounded-lg bg-white p-3">
              <div className="text-sm">
                {eligibility.refundMethod === 'ORIGINAL_CARD' && (
                  <>
                    <div className="font-medium text-gray-900">💳 退回原付款信用卡</div>
                    <div className="mt-1 text-xs text-gray-600">
                      刷退需要 3-5 個工作日，時間依發卡銀行作業而定
                    </div>
                  </>
                )}
                {eligibility.refundMethod === 'POINTS' && (
                  <>
                    <div className="font-medium text-gray-900">⭐ 退回點數帳戶</div>
                    <div className="mt-1 text-xs text-gray-600">立即入帳至會員點數</div>
                  </>
                )}
                {eligibility.refundMethod === 'VOUCHER' && (
                  <>
                    <div className="font-medium text-gray-900">🎟️ 恢復使用券</div>
                    <div className="mt-1 text-xs text-gray-600">恢復原使用券至帳戶</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 取消按鈕 */}
          <div className="space-y-2">
            {!confirmOpen ? (
              <Button
                onClick={() => setConfirmOpen(true)}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                確認取消並申請退款
              </Button>
            ) : (
              <>
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-900">確認取消</AlertTitle>
                  <AlertDescription className="text-orange-800">
                    此操作無法撤銷。確認後將立即申請退款。
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    size="lg"
                  >
                    {isPending ? '取消中...' : '確認取消'}
                  </Button>
                  <Button
                    onClick={() => setConfirmOpen(false)}
                    disabled={isPending}
                    variant="secondary"
                    className="flex-1"
                    size="lg"
                  >
                    返回
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ═════════════════════════════════════════════
  // 情景 2：超期取消（需人工審核）
  // ═════════════════════════════════════════════
  if (eligibility.scenario === 'LATE_CANCEL' && eligibility.requiresManualReview) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            已超過自助取消時限
          </CardTitle>
          <CardDescription className="text-amber-800">
            取消期限：開打前 24 小時
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 時間線 */}
          <div className="space-y-2 rounded-lg bg-white p-4">
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">截止時間</span>
                <span className="font-medium">
                  {eligibility.cancelDeadlineAt
                    ? new Date(eligibility.cancelDeadlineAt).toLocaleString('zh-TW', {
                        timeZone: 'Asia/Taipei',
                      })
                    : '未知'}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2">
                <span className="text-gray-600">超期時間</span>
                <span className="font-medium text-amber-700">
                  {Math.abs(eligibility.minutesBeforeCancelDeadline)} 分鐘
                </span>
              </div>
            </div>
          </div>

          {/* 說明 */}
          <Alert className="border-amber-300 bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>需要人工審核</AlertTitle>
            <AlertDescription>
              您可以申請人工審核。客服可能根據情況決定是否允許取消或部分退款。
            </AlertDescription>
          </Alert>

          {/* 聯繫客服 */}
          <div className="space-y-2">
            <Button
              onClick={onContactSupport}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              📞 聯繫客服申請人工審核
            </Button>
            <p className="text-xs text-gray-600">
              客服時間：每日 10:00-18:00（假日休）
              <br />
              LINE：@pickle-heaven-official
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ═════════════════════════════════════════════
  // 情景 3：已報到（禁止取消）
  // ═════════════════════════════════════════════
  if (eligibility.scenario === 'CHECKED_IN') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertCircle className="h-5 w-5" />
            無法取消
          </CardTitle>
          <CardDescription className="text-red-800">
            訂單已報到，不提供取消與退款
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert className="border-red-300 bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>已報到訂單</AlertTitle>
            <AlertDescription>
              訂單已報到（check-in），無法進行取消或退款。如有特殊情況，請聯繫現場工作人員或客服。
            </AlertDescription>
          </Alert>

          <Button
            onClick={onContactSupport}
            variant="secondary"
            className="w-full"
            size="lg"
          >
            📞 聯繫客服
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ═════════════════════════════════════════════
  // 情景 4：其他（已取消等）
  // ═════════════════════════════════════════════
  return (
    <Card className="border-gray-200 bg-gray-50">
      <CardHeader>
        <CardTitle className="text-gray-900">取消訂單</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>無法取消</AlertTitle>
          <AlertDescription>{eligibility.message}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
