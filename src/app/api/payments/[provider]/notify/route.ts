import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPaymentProvider, isProviderId } from '@/lib/payments'
import { markBookingPaid, recordPaymentFailure } from '@/server/booking-service'
import { findTopUpByCode, markTopUpPaid, recordTopUpFailure } from '@/server/topup-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 金流商 server-to-server 通知。
 *
 * 這是訂單成立的權威來源：即使使用者在付款後關閉頁面，
 * 訂單仍會因為這支端點而正確成立並發出 LINE 通知。
 * 金流商可能重送通知，因此 markBookingPaid 具冪等性。
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params

  if (!isProviderId(providerId)) {
    return NextResponse.json({ error: '未知的金流代號' }, { status: 404 })
  }

  const provider = getPaymentProvider(providerId)

  try {
    const result = await provider.handleCallback(req)

    // 儲值單（TP-…）：付款確認後入點，與訂場分開處理
    if (/^TP-?\d{8}/.test(result.bookingCode)) {
      const order = await findTopUpByCode(result.bookingCode)
      if (!order) return new NextResponse('BOOKING_NOT_FOUND', { status: 404 })
      if (result.ok) {
        if (result.amount != null && result.amount !== order.amount) {
          console.error('[notify] 儲值金額不符', { expected: order.amount, got: result.amount })
          await recordTopUpFailure(order.id, providerId, '回呼金額與儲值金額不符', result.raw, { keepPending: true })
          return new NextResponse('AMOUNT_MISMATCH', { status: 400 })
        }
        await markTopUpPaid(order.id, { provider: providerId, method: provider.method, amount: order.amount, providerRef: result.providerRef, cardLast4: result.cardLast4, cardBrand: result.cardBrand, raw: result.raw })
      } else {
        await recordTopUpFailure(order.id, providerId, result.failReason ?? '付款失敗', result.raw)
      }
      return new NextResponse(result.ack.body, { status: 200, headers: { 'Content-Type': result.ack.contentType } })
    }

    const booking = await findBookingByCode(result.bookingCode)

    if (!booking) {
      console.error('[notify] 找不到對應訂單', { providerId, code: result.bookingCode })
      return new NextResponse('BOOKING_NOT_FOUND', { status: 404 })
    }

    if (result.ok) {
      // 金額必須與訂單一致，避免被竄改的回呼
      if (result.amount != null && result.amount !== booking.total) {
        console.error('[notify] 金額不符', { expected: booking.total, got: result.amount })
        await recordPaymentFailure(booking.id, providerId, '回呼金額與訂單金額不符', result.raw)
        return new NextResponse('AMOUNT_MISMATCH', { status: 400 })
      }

      await markBookingPaid(booking.id, {
        provider: providerId,
        method: provider.method,
        amount: booking.total,
        providerRef: result.providerRef,
        cardLast4: result.cardLast4,
        cardBrand: result.cardBrand,
        raw: result.raw,
      })
    } else {
      await recordPaymentFailure(booking.id, providerId, result.failReason ?? '付款失敗', result.raw)
    }

    return new NextResponse(result.ack.body, {
      status: 200,
      headers: { 'Content-Type': result.ack.contentType },
    })
  } catch (err) {
    console.error('[notify] 處理失敗', err)
    return new NextResponse('ERROR', { status: 500 })
  }
}

/**
 * 依訂單編號尋找訂單。
 * 部分金流商（如藍新）不接受訂單編號中的連字號，送出前已移除，
 * 此處一併還原比對。
 */
async function findBookingByCode(code: string) {
  if (!code) return null

  const direct = await prisma.booking.findUnique({ where: { code } })
  if (direct) return direct

  // PHYYYYMMDDXXXX → PH-YYYYMMDD-XXXX
  const m = /^([A-Z]{2})(\d{8})([A-Z0-9]{4})$/.exec(code)
  if (!m) return null
  return prisma.booking.findUnique({ where: { code: `${m[1]}-${m[2]}-${m[3]}` } })
}
