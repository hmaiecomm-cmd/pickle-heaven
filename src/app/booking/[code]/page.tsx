'use client'

/**
 * 訂單詳情頁面
 *
 * 顯示：
 * - 訂單摘要（日期、金額、狀態）
 * - 取消面板（符合條件時）
 * - 退款歷史
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CancellationPanel } from '../components/cancellation-panel'
import type { RefundEligibilityResult } from '@/lib/refund-rule-engine'

export default function BookingDetailPage({
  params,
}: {
  params: { code: string }
}) {
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [eligibility, setEligibility] = useState<RefundEligibilityResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelInProgress, setCancelInProgress] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  // 載入訂單詳情
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/booking/${params.code}`)

        if (!response.ok) {
          throw new Error('無法載入訂單')
        }

        const data = await response.json()
        setBooking(data.booking)
        setEligibility(data.eligibility)
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗')
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [params.code])

  // 處理取消訂單
  const handleCancelBooking = async (bookingId: string) => {
    try {
      setCancelInProgress(true)
      const response = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '取消失敗')
      }

      const result = await response.json()
      setCancelSuccess(true)

      // 1 秒後導向完成頁面
      setTimeout(() => {
        router.push(`/booking/${params.code}/cancelled?refundId=${result.refund.id}`)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消失敗')
    } finally {
      setCancelInProgress(false)
    }
  }

  // 聯繫客服
  const handleContactSupport = () => {
    window.location.href = 'https://line.me/R/oaMessage/@pickle-heaven'
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">載入訂單中...</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>載入失敗</AlertTitle>
          <AlertDescription>{error || '無法找到訂單'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (cancelSuccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle className="h-6 w-6" />
              取消成功
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-800">
              您的訂單已成功取消，退款申請已提交。
              <br />
              跳轉至確認頁面中...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ═════════════════════════════════════════════
  // 正常訂單詳情頁面
  // ═════════════════════════════════════════════

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 頁面標題 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">訂單詳情</h1>
        <p className="text-gray-600">訂單代號：{booking.code}</p>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>操作失敗</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 訂單摘要 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>訂單摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* 狀態 */}
            <div>
              <div className="text-xs font-medium uppercase text-gray-600">狀態</div>
              <div className="mt-1 flex items-center gap-2">
                {booking.status === 'PAID' && (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-900">已付款</span>
                  </>
                )}
                {booking.status === 'PENDING' && (
                  <>
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-900">待付款</span>
                  </>
                )}
                {booking.status === 'CANCELLED' && (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-900">已取消</span>
                  </>
                )}
              </div>
            </div>

            {/* 預約日期 */}
            <div>
              <div className="text-xs font-medium uppercase text-gray-600">預約日期</div>
              <div className="mt-1 font-semibold">{booking.playDate}</div>
            </div>

            {/* 金額 */}
            <div>
              <div className="text-xs font-medium uppercase text-gray-600">訂單金額</div>
              <div className="mt-1 font-semibold">NT${booking.total}</div>
            </div>

            {/* 場館 */}
            <div>
              <div className="text-xs font-medium uppercase text-gray-600">場館</div>
              <div className="mt-1 font-semibold">{booking.venue?.name}</div>
            </div>
          </div>

          {/* 聯絡資訊 */}
          <div className="border-t pt-4">
            <div className="text-sm">
              <div className="text-gray-600">聯絡人</div>
              <div className="font-medium">{booking.contactName}</div>
            </div>
            <div className="mt-2 text-sm">
              <div className="text-gray-600">聯絡電話</div>
              <div className="font-medium">{booking.contactPhone}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 訂單項目 */}
      {booking.items && booking.items.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>訂購項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {booking.items.map((item: any) => (
                <div key={item.id} className="flex justify-between border-b pb-3">
                  <div>
                    <div className="font-medium">{item.courtName}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(item.startsAt).toLocaleString('zh-TW')} ~{' '}
                      {new Date(item.endsAt).toLocaleTimeString('zh-TW')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">NT${item.price}</div>
                    <div className="text-xs text-gray-600">{item.rateName}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 取消面板（關鍵步驟） */}
      {booking.status === 'PAID' && eligibility && (
        <CancellationPanel
          bookingId={booking.id}
          bookingCode={booking.code}
          eligibility={eligibility}
          onCancelConfirm={handleCancelBooking}
          onContactSupport={handleContactSupport}
        />
      )}

      {/* 已報到提示 */}
      {booking.checkedInAt && (
        <Alert className="my-6 border-blue-200 bg-blue-50">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle className="text-blue-900">已報到</AlertTitle>
          <AlertDescription className="text-blue-800">
            訂單已報到於 {new Date(booking.checkedInAt).toLocaleString('zh-TW')}
          </AlertDescription>
        </Alert>
      )}

      {/* 退款歷史 */}
      {booking.refunds && booking.refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>退款紀錄</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {booking.refunds.map((refund: any) => (
                <div key={refund.id} className="border-b pb-4">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">
                        {refund.status === 'SUCCEEDED' && '✓ 退款已完成'}
                        {refund.status === 'PROCESSING' && '⏳ 退款處理中'}
                        {refund.status === 'FAILED' && '✗ 退款失敗'}
                        {refund.status === 'MANUAL_PENDING' && '👤 待人工審核'}
                      </div>
                      <div className="text-sm text-gray-600">
                        申請於 {new Date(refund.createdAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-right font-semibold">NT${refund.cashAmount}</div>
                  </div>
                  {refund.note && (
                    <div className="mt-2 text-xs text-gray-600">{refund.note}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 返回按鈕 */}
      <div className="mt-8">
        <Button variant="outline" onClick={() => router.back()}>
          ← 返回
        </Button>
      </div>
    </div>
  )
}
