import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getBookingDetail } from '@/server/booking-service'
import { availableProviders } from '@/lib/payments'
import { LoginPrompt } from '@/components/login-prompt'
import { RetryPaymentClient } from './retry-payment-client'

export const metadata: Metadata = { title: '完成付款' }
export const dynamic = 'force-dynamic'

/** 待付款訂單的付款頁（付款中斷或失敗後可從「我的預約」回到這裡重試） */
export default async function RetryPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()])

  if (!user) return <LoginPrompt title="登入後完成付款" description="請先以 LINE 登入以繼續付款流程。" />

  const booking = await getBookingDetail(id, user.id)
  if (!booking) notFound()

  if (booking.status === 'PAID' || booking.status === 'COMPLETED') redirect(`/bookings/${id}`)

  const providers = availableProviders()

  return (
    <RetryPaymentClient
      bookingId={booking.id}
      code={booking.code}
      status={booking.status}
      total={booking.total}
      playDate={booking.playDate}
      expiresAt={booking.expiresAt?.toISOString() ?? null}
      items={booking.itemViews.map((it) => ({
        courtName: it.courtName,
        timeLabel: it.timeLabel,
        price: it.price,
      }))}
      providers={
        providers.length > 0
          ? providers
          : [{ id: 'mock', displayName: '測試信用卡（模擬）', method: 'CREDIT_CARD' }]
      }
    />
  )
}
