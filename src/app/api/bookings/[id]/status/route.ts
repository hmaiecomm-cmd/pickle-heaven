import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { linepayProvider } from '@/lib/payments'
import { expireStaleBookings, markBookingPaid, recordPaymentFailure } from '@/server/booking-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 查詢訂單付款狀態（結帳結果頁輪詢用）。
 *
 * 若帶入 transactionId（LINE Pay 導回），會先呼叫 Confirm API 完成扣款，
 * 這是 LINE Pay 流程中真正產生交易的一步。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  await expireStaleBookings()

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, total: true, code: true },
  })

  if (!booking || booking.userId !== user.id) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const transactionId = new URL(req.url).searchParams.get('transactionId')

  if (transactionId && booking.status === 'PENDING') {
    try {
      const result = await linepayProvider.confirm!({
        transactionId,
        amount: String(booking.total),
      })

      if (result.ok) {
        await markBookingPaid(booking.id, {
          provider: 'linepay',
          method: 'LINE_PAY',
          amount: booking.total,
          providerRef: result.providerRef,
          raw: result.raw,
        })
        return NextResponse.json({ status: 'PAID' })
      }

      await recordPaymentFailure(booking.id, 'linepay', result.failReason ?? '付款失敗', result.raw)
    } catch (err) {
      console.error('[linepay] confirm 失敗', err)
    }
  }

  const fresh = await prisma.booking.findUnique({ where: { id }, select: { status: true } })
  return NextResponse.json({ status: fresh?.status ?? booking.status })
}
