import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getBookingDetail } from '@/server/booking-service'
import { LoginPrompt } from '@/components/login-prompt'
import { BookingDetailClient } from './booking-detail-client'

export const metadata: Metadata = { title: '預約詳情' }
export const dynamic = 'force-dynamic'

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getSessionUser()])

  if (!user) {
    return <LoginPrompt title="登入後查看預約" description="這筆預約需要登入才能檢視，請使用 LINE 登入。" />
  }

  const booking = await getBookingDetail(id, user.id)
  if (!booking) notFound()

  const payment = booking.payments.find((p) => p.status === 'SUCCESS') ?? booking.payments[0] ?? null

  return (
    <BookingDetailClient
      justCreated={sp.new === '1'}
      booking={{
        id: booking.id,
        code: booking.code,
        status: booking.status,
        playDate: booking.playDate,
        subtotal: booking.subtotal,
        discount: booking.discount,
        pointsUsed: booking.pointsUsed,
        total: booking.total,
        contactName: booking.contactName,
        contactPhone: booking.contactPhone,
        note: booking.note,
        paidAt: booking.paidAt?.toISOString() ?? null,
        expiresAt: booking.expiresAt?.toISOString() ?? null,
        venue: {
          name: booking.venue.name,
          address: booking.venue.address,
          phone: booking.venue.phone,
          notice: booking.venue.notice,
          policy: booking.venue.policy,
        },
        items: booking.itemViews.map((it) => ({
          courtName: it.courtName,
          timeLabel: it.timeLabel,
          rateName: it.rateName,
          price: it.price,
        })),
        activities: booking.activityViews.map((it) => ({
          title: it.title,
          date: it.date,
          timeLabel: it.timeLabel,
          courtNames: it.courtNames,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amount: it.amount,
          status: it.status,
        })),
        payment: payment
          ? {
              provider: payment.provider,
              method: payment.method,
              status: payment.status,
              cardLast4: payment.cardLast4,
              cardBrand: payment.cardBrand,
              providerRef: payment.providerRef,
            }
          : null,
      }}
    />
  )
}
