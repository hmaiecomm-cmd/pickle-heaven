import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertBookableDate, getCart, releaseExpiredHolds } from '@/lib/availability'
import { applyVoucher, refundRatio, resolveRate } from '@/lib/pricing'
import { addDays, formatRange, now, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { makeBookingCode, normalizeTwMobile, isTwMobile } from '@/lib/utils'
import { notifyBookingCancelled, notifyBookingConfirmed } from '@/lib/line'
import { getPaymentProvider } from '@/lib/payments'
import type { CartDTO } from '@/lib/types'

/** 待付款訂單的付款期限（分鐘） */
export const PAYMENT_WINDOW_MINUTES = 15

export class BookingError extends Error {
  constructor(
    message: string,
    public code:
      | 'UNAUTHORIZED'
      | 'SLOT_TAKEN'
      | 'HOLD_EXPIRED'
      | 'CART_EMPTY'
      | 'INVALID_INPUT'
      | 'NOT_FOUND'
      | 'PAYMENT_FAILED'
      | 'BOOKING_CLOSED' = 'INVALID_INPUT',
  ) {
    super(message)
    this.name = 'BookingError'
  }
}

/* ────────────────────────────── 購物車暫扣 ────────────────────────────── */

/**
 * 暫扣一個時段。
 * (courtId, startsAt) 的唯一索引即為併發鎖：
 * 兩人同時點同一格時，只有一人的 INSERT 會成功，另一人得到 SLOT_TAKEN。
 */
export async function holdSlot(
  cartToken: string,
  venueSlug: string,
  dateStr: string,
  courtId: string,
  startMinute: number,
): Promise<{ reservationId: string; expiresAt: Date }> {
  await releaseExpiredHolds()

  const court = await prisma.court.findFirst({
    where: { id: courtId, active: true, venue: { slug: venueSlug, active: true } },
    include: { venue: true },
  })
  if (!court) throw new BookingError('找不到該場地', 'NOT_FOUND')

  const venue = court.venue
  assertBookableDate(dateStr, venue.bookAheadDays)

  if (startMinute < venue.openMinute || startMinute + venue.slotMinutes > venue.closeMinute) {
    throw new BookingError('該時段不在營業時間內', 'INVALID_INPUT')
  }

  const startsAt = taipeiToUtc(dateStr, startMinute)
  if (startsAt.getTime() <= now().getTime()) {
    throw new BookingError('無法預約已過去的時段', 'BOOKING_CLOSED')
  }

  const endsAt = taipeiToUtc(dateStr, startMinute + venue.slotMinutes)
  const expiresAt = new Date(now().getTime() + venue.holdMinutes * 60_000)

  try {
    const created = await prisma.reservation.create({
      data: {
        courtId,
        startsAt,
        endsAt,
        status: 'HELD',
        holdExpiresAt: expiresAt,
        cartToken,
      },
    })
    return { reservationId: created.id, expiresAt }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BookingError('這個時段剛剛被其他人選走了', 'SLOT_TAKEN')
    }
    throw err
  }
}

/** 釋放自己購物車中的暫扣 */
export async function releaseSlot(
  cartToken: string,
  courtId: string,
  dateStr: string,
  startMinute: number,
): Promise<void> {
  const startsAt = taipeiToUtc(dateStr, startMinute)
  await prisma.reservation.deleteMany({
    where: { cartToken, courtId, startsAt, status: 'HELD', bookingId: null },
  })
}

export async function releaseReservation(cartToken: string, reservationId: string): Promise<void> {
  await prisma.reservation.deleteMany({
    where: { id: reservationId, cartToken, status: 'HELD', bookingId: null },
  })
}

/** 清空購物車（不影響已成立訂單的暫扣） */
export async function clearCart(cartToken: string): Promise<number> {
  const res = await prisma.reservation.deleteMany({
    where: { cartToken, status: 'HELD', bookingId: null },
  })
  return res.count
}

/** 延長購物車暫扣時間（使用者仍在結帳頁時呼叫） */
export async function extendHolds(cartToken: string, minutes: number): Promise<Date> {
  const expiresAt = new Date(now().getTime() + minutes * 60_000)
  await prisma.reservation.updateMany({
    where: { cartToken, status: 'HELD', bookingId: null },
    data: { holdExpiresAt: expiresAt },
  })
  return expiresAt
}

/* ────────────────────────────── 折價券試算 ────────────────────────────── */

export interface QuoteResult {
  subtotal: number
  discount: number
  pointsUsed: number
  total: number
  voucher: { code: string; title: string } | null
  voucherError?: string
}

export async function quote(
  cart: CartDTO,
  userId: string,
  voucherCode?: string | null,
  requestedPoints = 0,
): Promise<QuoteResult> {
  const subtotal = cart.subtotal
  let discount = 0
  let voucher: { code: string; title: string } | null = null
  let voucherError: string | undefined

  if (voucherCode) {
    const v = await prisma.voucher.findUnique({ where: { code: voucherCode.trim().toUpperCase() } })
    if (!v) voucherError = '折價券不存在'
    else if (v.usedAt || v.bookingId) voucherError = '此折價券已使用過'
    else if (v.expiresAt && v.expiresAt < now()) voucherError = '折價券已過期'
    else if (v.userId && v.userId !== userId) voucherError = '此折價券非本帳號專屬'
    else if (subtotal < v.minSpend) voucherError = `消費滿 NT$${v.minSpend} 才可使用`
    else {
      discount = applyVoucher(subtotal, { type: v.type, value: v.value, minSpend: v.minSpend })
      voucher = { code: v.code, title: v.title }
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } })
  const maxPoints = Math.max(0, Math.min(requestedPoints, user?.points ?? 0, subtotal - discount))
  const pointsUsed = Math.floor(maxPoints)

  return {
    subtotal,
    discount,
    pointsUsed,
    total: Math.max(0, subtotal - discount - pointsUsed),
    voucher,
    voucherError,
  }
}

/* ────────────────────────────── 建立訂單 ────────────────────────────── */

export interface CreateBookingInput {
  contactName: string
  contactPhone: string
  note?: string
  voucherCode?: string | null
  usePoints?: number
}

/**
 * 由購物車建立「待付款」訂單。
 * 所有金額一律於伺服器端依費率規則重算，不信任前端傳來的價格。
 */
export async function createPendingBooking(
  userId: string,
  cartToken: string,
  input: CreateBookingInput,
): Promise<{ bookingId: string; code: string; total: number }> {
  if (!input.contactName?.trim()) throw new BookingError('請填寫聯絡人姓名')
  if (!isTwMobile(input.contactPhone ?? '')) throw new BookingError('請填寫正確的台灣手機號碼')

  await releaseExpiredHolds()

  const held = await prisma.reservation.findMany({
    where: { cartToken, status: 'HELD', bookingId: null },
    include: { court: { include: { venue: { include: { priceRules: true } } } } },
    orderBy: { startsAt: 'asc' },
  })

  if (held.length === 0) throw new BookingError('購物車是空的，或選取的時段已逾時釋放', 'CART_EMPTY')

  const venue = held[0].court.venue
  if (held.some((r) => r.court.venueId !== venue.id)) {
    throw new BookingError('一張訂單僅能包含同一場館的時段')
  }

  // 伺服器端重算價格
  const priced = held.map((r) => {
    let dateStr = taipeiDateString(r.startsAt)
    let start = Math.round((r.startsAt.getTime() - taipeiToUtc(dateStr, 0).getTime()) / 60_000)
    if (start < venue.openMinute) {
      dateStr = addDays(dateStr, -1)
      start += 1440
    }
    const end = start + Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60_000)
    const rate = resolveRate(dateStr, start, venue.priceRules)
    return { reservation: r, dateStr, start, end, rate }
  })

  const subtotal = priced.reduce((sum, p) => sum + p.rate.price, 0)
  const q = await quote({ items: [], subtotal, expiresAt: null }, userId, input.voucherCode, input.usePoints ?? 0)
  if (q.voucherError && input.voucherCode) throw new BookingError(q.voucherError)

  const playDate = priced[0].dateStr
  const code = makeBookingCode(playDate)
  const expiresAt = new Date(now().getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
  const reservationIds = held.map((r) => r.id)

  const booking = await prisma.$transaction(async (tx) => {
    // 再次確認暫扣仍屬於本購物車且未逾時（防止交易期間被釋放）
    const stillHeld = await tx.reservation.count({
      where: {
        id: { in: reservationIds },
        cartToken,
        status: 'HELD',
        bookingId: null,
        holdExpiresAt: { gt: now() },
      },
    })
    if (stillHeld !== reservationIds.length) {
      throw new BookingError('部分時段的保留已逾時，請重新選擇', 'HOLD_EXPIRED')
    }

    const created = await tx.booking.create({
      data: {
        code,
        userId,
        venueId: venue.id,
        playDate,
        status: 'PENDING',
        subtotal,
        discount: q.discount,
        pointsUsed: q.pointsUsed,
        total: q.total,
        contactName: input.contactName.trim(),
        contactPhone: normalizeTwMobile(input.contactPhone),
        note: input.note?.trim() || null,
        voucherCode: q.voucher?.code ?? null,
        expiresAt,
        items: {
          create: priced.map((p) => ({
            courtId: p.reservation.courtId,
            courtName: p.reservation.court.name,
            startsAt: p.reservation.startsAt,
            endsAt: p.reservation.endsAt,
            price: p.rate.price,
            rateName: p.rate.name,
          })),
        },
      },
    })

    // 暫扣轉綁訂單，並將保留時間延長至付款期限
    await tx.reservation.updateMany({
      where: { id: { in: reservationIds } },
      data: { bookingId: created.id, holdExpiresAt: expiresAt },
    })

    // 以 Voucher.bookingId 的唯一鍵鎖定折價券，避免同一張被重複使用
    if (q.voucher) {
      const claimed = await tx.voucher.updateMany({
        where: { code: q.voucher.code, usedAt: null, bookingId: null },
        data: { bookingId: created.id },
      })
      if (claimed.count === 0) throw new BookingError('折價券已被使用')
    }

    if (q.pointsUsed > 0) {
      const spent = await tx.user.updateMany({
        where: { id: userId, points: { gte: q.pointsUsed } },
        data: { points: { decrement: q.pointsUsed } },
      })
      if (spent.count === 0) throw new BookingError('點數不足')
    }

    return created
  })

  // 全額以點數／折價券折抵時，直接視為已付款
  if (booking.total === 0) {
    await markBookingPaid(booking.id, {
      provider: 'internal',
      method: 'CREDIT_CARD',
      amount: 0,
      providerRef: `FREE-${booking.code}`,
    })
  }

  return { bookingId: booking.id, code: booking.code, total: booking.total }
}

/* ────────────────────────────── 付款狀態轉換 ────────────────────────────── */

export interface PaidInfo {
  provider: string
  method: 'CREDIT_CARD' | 'LINE_PAY'
  amount: number
  providerRef: string
  cardLast4?: string | null
  cardBrand?: string | null
  raw?: Record<string, unknown>
}

/**
 * 標記訂單已付款（具冪等性）。
 * 金流商可能重送通知，重複呼叫不會產生副作用。
 */
export async function markBookingPaid(bookingId: string, info: PaidInfo): Promise<{ alreadyPaid: boolean }> {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  })
  if (!existing) throw new BookingError('找不到訂單', 'NOT_FOUND')
  if (existing.status === 'PAID' || existing.status === 'COMPLETED') return { alreadyPaid: true }
  if (existing.status === 'CANCELLED') throw new BookingError('訂單已取消，無法完成付款', 'PAYMENT_FAILED')

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'PAID', paidAt: now(), expiresAt: null },
    })

    // 暫扣正式轉為已預約
    await tx.reservation.updateMany({
      where: { bookingId },
      data: { status: 'BOOKED', holdExpiresAt: null, cartToken: null },
    })

    await tx.payment.create({
      data: {
        bookingId,
        provider: info.provider,
        method: info.method,
        amount: info.amount,
        status: 'SUCCESS',
        providerRef: info.providerRef,
        cardLast4: info.cardLast4 ?? null,
        cardBrand: info.cardBrand ?? null,
        rawResponse: (info.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        paidAt: now(),
      },
    })

    await tx.voucher.updateMany({ where: { bookingId }, data: { usedAt: now() } })
  })

  await sendConfirmationNotification(bookingId)
  return { alreadyPaid: false }
}

/** 記錄付款失敗（訂單仍為 PENDING，使用者可重試） */
export async function recordPaymentFailure(
  bookingId: string,
  provider: string,
  reason: string,
  raw?: Record<string, unknown>,
): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { total: true } })
  await prisma.payment.create({
    data: {
      bookingId,
      provider,
      amount: booking?.total ?? 0,
      status: 'FAILED',
      failReason: reason.slice(0, 500),
      rawResponse: (raw ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

async function sendConfirmationNotification(bookingId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true, venue: true, items: { orderBy: { startsAt: 'asc' } } },
    })
    if (!booking?.user.lineUserId) return

    await notifyBookingConfirmed(booking.user.lineUserId, {
      bookingId: booking.id,
      code: booking.code,
      venueName: booking.venue.name,
      venueAddress: booking.venue.address,
      playDate: booking.playDate,
      total: booking.total,
      items: booking.items.map((it) => {
        const base = taipeiToUtc(booking.playDate, 0).getTime()
        return {
          courtName: it.courtName,
          startMinute: Math.round((it.startsAt.getTime() - base) / 60_000),
          endMinute: Math.round((it.endsAt.getTime() - base) / 60_000),
        }
      }),
    })
  } catch (err) {
    // 通知失敗不影響訂單成立
    console.error('[booking] LINE 通知失敗', err)
  }
}

/* ────────────────────────────── 取消與逾時 ────────────────────────────── */

/** 取消訂單，依政策以點數回補 */
export async function cancelBooking(
  bookingId: string,
  actorUserId: string | null,
  opts: { asAdmin?: boolean; fullRefund?: boolean } = {},
): Promise<{ refundPoints: number; ratio: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: { orderBy: { startsAt: 'asc' } }, user: true, payments: true },
  })
  if (!booking) throw new BookingError('找不到訂單', 'NOT_FOUND')
  if (!opts.asAdmin && booking.userId !== actorUserId) throw new BookingError('無權限操作此訂單', 'UNAUTHORIZED')
  if (booking.status === 'CANCELLED') throw new BookingError('訂單已取消')
  if (booking.status === 'COMPLETED') throw new BookingError('訂單已完成，無法取消')

  const firstStart = booking.items[0]?.startsAt ?? now()
  const hoursBefore = (firstStart.getTime() - now().getTime()) / 3_600_000
  const ratio = opts.fullRefund || opts.asAdmin ? 1 : refundRatio(hoursBefore)

  // 已支付金額與已折抵點數皆按比例回補為點數
  const refundable = booking.status === 'PAID' ? booking.total + booking.pointsUsed : booking.pointsUsed
  const refundPoints = Math.round(refundable * ratio)

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelledAt: now(), expiresAt: null },
    })
    // 釋放時段供他人預約（歷史保留於 BookingItem）
    await tx.reservation.deleteMany({ where: { bookingId } })

    if (refundPoints > 0) {
      await tx.user.update({ where: { id: booking.userId }, data: { points: { increment: refundPoints } } })
    }
    // 未使用完成的折價券歸還
    await tx.voucher.updateMany({ where: { bookingId }, data: { bookingId: null, usedAt: null } })

    await tx.auditLog.create({
      data: {
        actor: opts.asAdmin ? `admin:${actorUserId ?? 'system'}` : `user:${actorUserId ?? 'system'}`,
        action: 'BOOKING_CANCELLED',
        target: booking.code,
        detail: { ratio, refundPoints, status: booking.status },
      },
    })
  })

  // 若已透過金流付款，嘗試向金流商申請退款（失敗僅記錄，點數已回補）
  const successPayment = booking.payments.find((p) => p.status === 'SUCCESS' && p.providerRef)
  if (successPayment && ratio > 0 && successPayment.provider !== 'internal') {
    const provider = getPaymentProvider(successPayment.provider)
    if (provider.refund) {
      try {
        const result = await provider.refund(successPayment.providerRef as string, Math.round(booking.total * ratio))
        if (result.ok) {
          await prisma.payment.update({
            where: { id: successPayment.id },
            data: { status: 'REFUNDED', refundedAt: now() },
          })
        }
      } catch (err) {
        console.error('[booking] 金流退款失敗，已改以點數回補', err)
      }
    }
  }

  await notifyBookingCancelled(booking.user.lineUserId, booking.code, refundPoints)
  return { refundPoints, ratio }
}

/**
 * 將逾時未付款的訂單標記為 EXPIRED 並釋放時段。
 * 由 /api/cron/expire-bookings 定期呼叫，讀取訂單時也會惰性觸發。
 */
export async function expireStaleBookings(): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now() } },
    select: { id: true, pointsUsed: true, userId: true },
  })
  if (stale.length === 0) return 0

  for (const b of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: 'EXPIRED' } })
      await tx.reservation.deleteMany({ where: { bookingId: b.id } })
      await tx.voucher.updateMany({ where: { bookingId: b.id }, data: { bookingId: null, usedAt: null } })
      if (b.pointsUsed > 0) {
        await tx.user.update({ where: { id: b.userId }, data: { points: { increment: b.pointsUsed } } })
      }
    })
  }
  return stale.length
}

/** 將已結束的訂單標記為完成 */
export async function completePastBookings(): Promise<number> {
  const res = await prisma.booking.updateMany({
    where: { status: 'PAID', items: { every: { endsAt: { lt: now() } } } },
    data: { status: 'COMPLETED' },
  })
  return res.count
}

/* ────────────────────────────── 查詢 ────────────────────────────── */

export async function getBookingDetail(bookingId: string, userId: string | null, asAdmin = false) {
  await expireStaleBookings()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      venue: true,
      items: { orderBy: { startsAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      user: { select: { displayName: true, phone: true, lineUserId: true } },
    },
  })
  if (!booking) return null
  if (!asAdmin && booking.userId !== userId) return null

  const base = taipeiToUtc(booking.playDate, 0).getTime()
  return {
    ...booking,
    itemViews: booking.items.map((it) => {
      const start = Math.round((it.startsAt.getTime() - base) / 60_000)
      const end = Math.round((it.endsAt.getTime() - base) / 60_000)
      return { ...it, start, end, timeLabel: formatRange(start, end) }
    }),
  }
}

export async function listUserBookings(userId: string) {
  await expireStaleBookings()

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: { venue: true, items: { orderBy: { startsAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const today = taipeiDateString()
  const isLive = (s: string) => s === 'PAID' || s === 'PENDING'
  return {
    upcoming: bookings.filter((b) => isLive(b.status) && b.playDate >= today),
    past: bookings.filter((b) => b.status === 'COMPLETED' || (b.status === 'PAID' && b.playDate < today)),
    cancelled: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'EXPIRED'),
    all: bookings,
  }
}

export { getCart }
