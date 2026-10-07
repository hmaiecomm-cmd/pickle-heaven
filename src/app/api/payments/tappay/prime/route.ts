import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { tappayProvider } from '@/lib/payments'
import { markBookingPaid, recordPaymentFailure } from '@/server/booking-service'
import { getSessionUser } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  bookingId: z.string().min(1),
  /** TapPay 前端 SDK 產生的一次性 token；不是卡號 */
  prime: z.string().min(1),
})

/**
 * 以 TapPay prime 完成請款。
 * prime 為一次性授權憑證，本端點不接收也不保存任何卡片資料。
 */
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: false, error: '請先登入' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: '參數錯誤' }, { status: 400 })

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { venue: true, items: true, user: true },
  })

  if (!booking || booking.userId !== user.id) {
    return NextResponse.json({ ok: false, error: '找不到訂單' }, { status: 404 })
  }
  if (booking.status === 'PAID') return NextResponse.json({ ok: true })
  if (booking.status !== 'PENDING') {
    return NextResponse.json({ ok: false, error: '此訂單無法付款' }, { status: 409 })
  }
  if (booking.expiresAt && booking.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: '付款時間已逾時，請重新預約' }, { status: 409 })
  }

  try {
    const result = await tappayProvider.payByPrime(
      {
        bookingId: booking.id,
        bookingCode: booking.code,
        amount: booking.total,
        description: `${booking.venue.name} 場地預約 ${booking.items.length} 個時段`,
        itemNames: booking.items.map((i) => i.courtName),
        customer: { name: booking.contactName, phone: booking.contactPhone, email: booking.user.email },
        returnUrl: '',
        notifyUrl: '',
        cancelUrl: '',
      },
      parsed.data.prime,
    )

    if (!result.ok) {
      await recordPaymentFailure(booking.id, 'tappay', result.failReason ?? '付款失敗', result.raw)
      return NextResponse.json({ ok: false, error: result.failReason ?? '付款失敗' }, { status: 402 })
    }

    await markBookingPaid(booking.id, {
      provider: 'tappay',
      method: 'CREDIT_CARD',
      amount: booking.total,
      providerRef: result.providerRef,
      cardLast4: result.cardLast4,
      cardBrand: result.cardBrand,
      raw: result.raw,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[tappay] 請款失敗', err)
    return NextResponse.json({ ok: false, error: '金流服務暫時無法使用，請稍後再試' }, { status: 502 })
  }
}
