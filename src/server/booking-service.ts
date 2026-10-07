import 'server-only'
import { Prisma, RegistrationStatus, SessionStatus } from '@prisma/client'
import { isDemoTenant, prisma } from '@/lib/db'
import { assertBookableDate, getCart, releaseExpiredHolds } from '@/lib/availability'
import { applyVoucher, refundRatio, resolveRate } from '@/lib/pricing'
import { addDays, formatDateTime, formatRange, now, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { makeBookingCode, normalizeTwMobile, isTwMobile } from '@/lib/utils'
import { notifyBookingCancelled, notifyBookingConfirmed, pushMessages } from '@/lib/line'
import { getPaymentProvider } from '@/lib/payments'
import type { CartDTO } from '@/lib/types'
import { activityTimeLabel } from '@/lib/activity-shared'
import { isUniqueViolation } from './occupancy'
import { notifySeatWatchers, publicCapacity, seatsUsed, visibleSessionWhere } from './activity-service'
import { syncRefundStatus } from './refund-service'
import { assertNotRestricted, RestrictedError } from './member-restrictions'
import { applyPoints } from './points-ledger'

/** 待付款訂單的付款期限（分鐘） */
export const PAYMENT_WINDOW_MINUTES = 15

const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 }

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
 * 兩人同時點同一格、或該格已被活動佔用時，INSERT 會失敗並回傳 SLOT_TAKEN。
 * 活動佔用、維護封場與一般訂場共用同一張表，因此這裡就是後端統一的衝突檢查。
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
  if ((startMinute - venue.openMinute) % venue.slotMinutes !== 0) {
    throw new BookingError('時段不正確', 'INVALID_INPUT')
  }

  const startsAt = taipeiToUtc(dateStr, startMinute)
  if (startsAt.getTime() <= now().getTime()) {
    throw new BookingError('這個時段已開始，無法線上預約', 'BOOKING_CLOSED')
  }
  if (startsAt.getTime() - venue.bookingCutoffMinutes * 60_000 <= now().getTime()) {
    throw new BookingError(`這個時段已超過預約截止時間（開打前 ${venue.bookingCutoffMinutes} 分鐘）`, 'BOOKING_CLOSED')
  }

  const endsAt = taipeiToUtc(dateStr, startMinute + venue.slotMinutes)
  const expiresAt = new Date(now().getTime() + venue.holdMinutes * 60_000)

  try {
    const created = await prisma.reservation.create({
      data: { courtId, startsAt, endsAt, status: 'HELD', holdExpiresAt: expiresAt, cartToken },
    })
    return { reservationId: created.id, expiresAt }
  } catch (err) {
    if (isUniqueViolation(err)) {
      const taken = await prisma.reservation.findUnique({
        where: { courtId_startsAt: { courtId, startsAt } },
        select: { status: true },
      })
      if (taken?.status === 'EVENT') throw new BookingError('這個時段已安排活動，無法租借場地', 'SLOT_TAKEN')
      if (taken?.status === 'BLOCKED') throw new BookingError('這個時段維護中，暫停預約', 'SLOT_TAKEN')
      throw new BookingError('這個時段剛剛被其他人選走了', 'SLOT_TAKEN')
    }
    throw err
  }
}

/** 釋放自己購物車中的暫扣 */
export async function releaseSlot(cartToken: string, courtId: string, dateStr: string, startMinute: number): Promise<void> {
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

/** 清空購物車（場地與活動；不影響已成立訂單的暫扣） */
export async function clearCart(cartToken: string): Promise<number> {
  const res = await prisma.reservation.deleteMany({
    where: { cartToken, status: 'HELD', bookingId: null },
  })
  const regs = await prisma.sessionRegistration.findMany({
    where: { cartToken, status: RegistrationStatus.PENDING, bookingId: null },
    select: { id: true, sessionId: true },
  })
  if (regs.length > 0) {
    await prisma.sessionRegistration.updateMany({
      where: { id: { in: regs.map((r) => r.id) }, status: RegistrationStatus.PENDING, bookingId: null },
      data: { status: RegistrationStatus.EXPIRED, holdExpiresAt: null, cartToken: null },
    })
    await notifySeatWatchers(regs.map((r) => r.sessionId)).catch(() => {})
  }
  return res.count + regs.length
}

/**
 * 延長購物車暫扣時間（使用者仍在結帳頁時呼叫）。
 * 只延長仍有效的暫扣；已逾時釋放的不會被救回，避免永久佔用。
 */
export async function extendHolds(cartToken: string, minutes: number): Promise<Date> {
  const at = now()
  const expiresAt = new Date(at.getTime() + minutes * 60_000)
  await prisma.reservation.updateMany({
    where: { cartToken, status: 'HELD', bookingId: null, holdExpiresAt: { gt: at } },
    data: { holdExpiresAt: expiresAt },
  })
  await prisma.sessionRegistration.updateMany({
    where: { cartToken, status: RegistrationStatus.PENDING, bookingId: null, holdExpiresAt: { gt: at } },
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
  cart: Pick<CartDTO, 'subtotal'>,
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
 * 由購物車建立「待付款」訂單（場地租借與活動報名可同一張）。
 * 所有金額一律於伺服器端重算，不信任前端傳來的價格。
 * 暫扣以「條件式更新」轉綁訂單：重複送出時第二次的更新筆數不符，整筆回滾，不會產生兩張訂單。
 */
/** UTC 時間 → 當天台北分鐘數（顯示用） */
const minuteOf = (d: Date) => Math.round((d.getTime() - taipeiToUtc(taipeiDateString(d), 0).getTime()) / 60_000)

export async function createPendingBooking(
  userId: string,
  cartToken: string,
  input: CreateBookingInput,
): Promise<{ bookingId: string; code: string; total: number }> {
  if (!input.contactName?.trim()) throw new BookingError('請填寫聯絡人姓名')
  if (!isTwMobile(input.contactPhone ?? '')) throw new BookingError('請填寫正確的台灣手機號碼')
  try {
    await assertNotRestricted(userId, 'BOOKING')
  } catch (err) {
    if (err instanceof RestrictedError) throw new BookingError(err.message, 'UNAUTHORIZED')
    throw err
  }

  await releaseExpiredHolds()
  const at = now()

  const held = await prisma.reservation.findMany({
    where: { cartToken, status: 'HELD', bookingId: null, holdExpiresAt: { gt: at } },
    include: { court: { include: { venue: { include: { priceRules: true } } } } },
    orderBy: { startsAt: 'asc' },
  })
  const regs = await prisma.sessionRegistration.findMany({
    where: { cartToken, status: RegistrationStatus.PENDING, bookingId: null, holdExpiresAt: { gt: at } },
    include: {
      session: {
        include: { activity: true, courts: { include: { court: { select: { name: true, sortOrder: true } } } } },
      },
    },
  })

  if (held.length === 0 && regs.length === 0) {
    throw new BookingError('購物車是空的，或選取的項目已逾時釋放', 'CART_EMPTY')
  }
  if (regs.some((r) => r.userId !== userId)) throw new BookingError('購物車中的活動報名不屬於目前登入的帳號，請重新加入', 'UNAUTHORIZED')

  const venueIds = new Set([...held.map((r) => r.court.venueId), ...regs.map((r) => r.session.venueId)])
  if (venueIds.size > 1) throw new BookingError('一張訂單僅能包含同一場館的項目')
  const venueId = [...venueIds][0]
  const venue = held[0]?.court.venue ?? (await prisma.venue.findUniqueOrThrow({ where: { id: venueId }, include: { priceRules: true } }))

  // 場地必須仍屬於本場館且啟用（例如場地已停用或下架）；不靜默換場
  for (const r of held) {
    if (!r.court.active || r.court.venueId !== venueId) {
      throw new BookingError(`「${r.court.name}」此場地已不可預約，請重新選擇`, 'BOOKING_CLOSED')
    }
  }
  // 場地時段在結帳當下不能已開始或已超過預約截止時間；購物車頁會先提示，這裡是最後防線
  for (const r of held) {
    if (r.startsAt.getTime() - venue.bookingCutoffMinutes * 60_000 <= at.getTime()) {
      throw new BookingError(`「${r.court.name} ${formatRange(minuteOf(r.startsAt), minuteOf(r.endsAt))}」已開始或已超過預約截止時間，請從購物車移除`, 'BOOKING_CLOSED')
    }
  }

  // 活動場次在結帳當下必須仍可報名（未取消、未截止），不能只因為場次存在就允許付款
  const visibleIds = new Set(
    (
      await prisma.session.findMany({
        where: { ...visibleSessionWhere(), id: { in: regs.map((r) => r.sessionId) } },
        select: { id: true },
      })
    ).map((s) => s.id),
  )
  for (const r of regs) {
    const s = r.session
    if (!visibleIds.has(s.id) || s.status === SessionStatus.CANCELLED) {
      throw new BookingError(`「${s.title}」已取消或下架，請從購物車移除`, 'BOOKING_CLOSED')
    }
    if (at >= s.bookingCloseAt || at >= s.startAt) {
      throw new BookingError(`「${s.title}」報名已截止，請從購物車移除`, 'BOOKING_CLOSED')
    }
  }

  // 伺服器端重算場地價格
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
  const activityLines = regs.map((r) => {
    const s = r.session
    return {
      reg: r,
      unitPrice: s.price,
      amount: s.price * r.quantity,
      date: taipeiDateString(s.startAt),
      courtNames: [...s.courts].sort((a, b) => a.court.sortOrder - b.court.sortOrder).map((c) => c.court.name).join('、'),
    }
  })

  const subtotal = priced.reduce((sum, p) => sum + p.rate.price, 0) + activityLines.reduce((sum, l) => sum + l.amount, 0)
  const q = await quote({ subtotal }, userId, input.voucherCode, input.usePoints ?? 0)
  if (q.voucherError && input.voucherCode) throw new BookingError(q.voucherError)

  const playDate = [...priced.map((p) => p.dateStr), ...activityLines.map((l) => l.date)].sort()[0]
  const code = makeBookingCode(playDate)
  const expiresAt = new Date(at.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
  const reservationIds = held.map((r) => r.id)
  const registrationIds = regs.map((r) => r.id)

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        code,
        userId,
        venueId,
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
        activityItems: {
          create: activityLines.map((l) => ({
            sessionId: l.reg.sessionId,
            registrationId: l.reg.id,
            title: l.reg.session.title,
            startsAt: l.reg.session.startAt,
            endsAt: l.reg.session.endAt,
            courtNames: l.courtNames,
            quantity: l.reg.quantity,
            seats: l.reg.seats,
            unitPrice: l.unitPrice,
            amount: l.amount,
            priceUnit: l.reg.session.activity?.priceUnit ?? 'PER_PERSON',
          })),
        },
      },
    })

    // 暫扣轉綁訂單（條件式），保留時間延長至付款期限
    if (reservationIds.length > 0) {
      const claimed = await tx.reservation.updateMany({
        where: { id: { in: reservationIds }, cartToken, status: 'HELD', bookingId: null, holdExpiresAt: { gt: now() } },
        data: { bookingId: created.id, holdExpiresAt: expiresAt },
      })
      if (claimed.count !== reservationIds.length) {
        throw new BookingError('部分時段的保留已逾時或已送出訂單，請重新整理購物車', 'HOLD_EXPIRED')
      }
    }
    if (registrationIds.length > 0) {
      const claimed = await tx.sessionRegistration.updateMany({
        where: {
          id: { in: registrationIds },
          cartToken,
          status: RegistrationStatus.PENDING,
          bookingId: null,
          holdExpiresAt: { gt: now() },
        },
        data: { bookingId: created.id, holdExpiresAt: expiresAt },
      })
      if (claimed.count !== registrationIds.length) {
        throw new BookingError('部分活動名額的保留已逾時或已送出訂單，請重新整理購物車', 'HOLD_EXPIRED')
      }
    }

    // 以 Voucher.bookingId 的唯一鍵鎖定折價券，避免同一張被重複使用
    if (q.voucher) {
      const claimed = await tx.voucher.updateMany({
        where: { code: q.voucher.code, usedAt: null, bookingId: null },
        data: { bookingId: created.id },
      })
      if (claimed.count === 0) throw new BookingError('折價券已被使用')
    }

    if (q.pointsUsed > 0) {
      try {
        await applyPoints(tx, { userId, delta: -q.pointsUsed, kind: 'REDEEM', reason: `訂單 ${created.code} 結帳折抵`, actor: `user:${userId}`, idempotencyKey: `redeem:${created.id}`, bookingId: created.id })
      } catch {
        throw new BookingError('點數不足')
      }
    }

    return created
  }, TX_OPTIONS)

  // 全額以點數／折價券折抵、或活動免費時，直接視為已付款
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

/**
 * 付款前檢查：訂單內的活動場次必須仍有效。已取消、已開始的場次不能繼續付款。
 */
export async function assertBookingPayable(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, expiresAt: true, userId: true } })
  if (!booking) throw new BookingError('找不到訂單', 'NOT_FOUND')
  if (booking.status !== 'PENDING') throw new BookingError('此訂單已取消或已處理，無法付款', 'PAYMENT_FAILED')
  if (booking.expiresAt && booking.expiresAt < now()) throw new BookingError('付款時間已逾時，請重新預約', 'HOLD_EXPIRED')
  // 付款前再次核驗帳戶限制（黑名單對已開啟的購物車與舊 session 同樣生效）
  try {
    await assertNotRestricted(booking.userId, 'BOOKING')
  } catch (err) {
    if (err instanceof RestrictedError) throw new BookingError(err.message, 'UNAUTHORIZED')
    throw err
  }
  const items = await prisma.bookingActivityItem.findMany({
    where: { bookingId, status: 'ACTIVE' },
    include: { session: { select: { title: true, status: true, deletedAt: true, startAt: true } } },
  })
  for (const it of items) {
    if (it.session.status === SessionStatus.CANCELLED || it.session.deletedAt) {
      throw new BookingError(`「${it.session.title}」已取消，無法付款`, 'BOOKING_CLOSED')
    }
    if (it.session.startAt <= now()) {
      throw new BookingError(`「${it.session.title}」已開始，無法付款`, 'BOOKING_CLOSED')
    }
  }
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

export type MarkPaidResult = { alreadyPaid: boolean; conflict?: string }

/**
 * 標記訂單已付款。
 *
 * 冪等：以「條件式更新訂單狀態」搶到處理權，金流重送通知或使用者重整頁面都只會處理一次、只記一筆收款。
 *
 * 逾時後才付款成功（或訂單／場次已取消）時，不直接視為成功：
 *   重新確認每個場地時段仍屬於這張訂單、每個活動名額仍在容量內；
 *   任何一項失效 → 訂單改為 REFUND_PENDING（款項已收、待退款），並嘗試向金流商退款。
 */
export async function markBookingPaid(bookingId: string, info: PaidInfo): Promise<MarkPaidResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { items: true, activityItems: true },
  })
  if (!booking) throw new BookingError('找不到訂單', 'NOT_FOUND')
  if (booking.status === 'PAID' || booking.status === 'COMPLETED' || booking.status === 'REFUND_PENDING') {
    return { alreadyPaid: true }
  }

  const at = now()
  const fromStatus = booking.status
  const lapsed = fromStatus !== 'PENDING' || (booking.expiresAt !== null && booking.expiresAt < at)

  const outcome = await prisma.$transaction(async (tx): Promise<{ claimed: boolean; conflict: string | null }> => {
    // 搶處理權：只有一個回呼能把狀態從原狀態改走
    const claim = await tx.booking.updateMany({
      where: { id: bookingId, status: fromStatus },
      data: { status: 'PAID', paidAt: at, expiresAt: null },
    })
    if (claim.count === 0) return { claimed: false, conflict: null }

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
        paidAt: at,
      },
    })

    let conflict: string | null = fromStatus === 'CANCELLED' ? '訂單已取消' : null

    // 場地：每個時段必須仍是這張訂單的
    if (!conflict) {
      for (const it of booking.items) {
        const row = await tx.reservation.findUnique({
          where: { courtId_startsAt: { courtId: it.courtId, startsAt: it.startsAt } },
          select: { id: true, bookingId: true },
        })
        if (row && row.bookingId === bookingId) continue
        if (row) {
          conflict = `${it.courtName} ${formatDateTime(it.startsAt)} 的時段已被其他預約使用`
          break
        }
        // 暫扣已被逾時清除但仍空著：補回
        await tx.reservation.create({
          data: { courtId: it.courtId, startsAt: it.startsAt, endsAt: it.endsAt, status: 'BOOKED', bookingId },
        })
      }
    }

    // 活動：場次仍有效、名額仍在容量內
    if (!conflict) {
      for (const it of booking.activityItems.filter((x) => x.status === 'ACTIVE')) {
        await tx.session.updateMany({ where: { id: it.sessionId }, data: { updatedAt: at } })
        const s = await tx.session.findUnique({ where: { id: it.sessionId } })
        const reg = await tx.sessionRegistration.findUnique({ where: { id: it.registrationId } })
        if (!s || s.status === SessionStatus.CANCELLED || s.deletedAt) {
          conflict = `「${it.title}」已取消`
          break
        }
        if (!reg || reg.bookingId !== bookingId || reg.status === RegistrationStatus.CONFIRMED) {
          conflict = `「${it.title}」的報名已失效`
          break
        }
        const stillHeld = reg.status === RegistrationStatus.PENDING && reg.holdExpiresAt !== null && reg.holdExpiresAt > at
        if (!stillHeld) {
          const used = (await seatsUsed([s.id], { db: tx, excludeRegistrationId: reg.id })).get(s.id) ?? 0
          if (used + reg.seats > publicCapacity(s)) {
            conflict = `「${it.title}」名額已滿`
            break
          }
        }
      }
    }

    if (conflict) {
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'REFUND_PENDING' } })
      await tx.reservation.deleteMany({ where: { bookingId } })
      await tx.sessionRegistration.updateMany({
        where: { bookingId, status: RegistrationStatus.PENDING },
        data: { status: RegistrationStatus.EXPIRED, holdExpiresAt: null, cartToken: null },
      })
      await tx.bookingActivityItem.updateMany({ where: { bookingId }, data: { status: 'CANCELLED' } })
      await tx.voucher.updateMany({ where: { bookingId }, data: { bookingId: null, usedAt: null } })
      if (booking.pointsUsed > 0 && fromStatus === 'PENDING') {
        await applyPoints(tx, { userId: booking.userId, delta: booking.pointsUsed, kind: 'RELEASE', reason: `訂單 ${booking.code} 付款失敗，歸還折抵點數`, actor: 'system', idempotencyKey: `release:${bookingId}:fail`, bookingId })
      }
      await tx.auditLog.create({
        data: {
          actor: `payment:${info.provider}`,
          action: 'PAYMENT_AFTER_EXPIRY',
          target: booking.code,
          detail: { reason: conflict, fromStatus, amount: info.amount, providerRef: info.providerRef },
        },
      })
      return { claimed: true, conflict }
    }

    await tx.reservation.updateMany({
      where: { bookingId },
      data: { status: 'BOOKED', holdExpiresAt: null, cartToken: null },
    })
    await tx.sessionRegistration.updateMany({
      where: { bookingId, status: { in: [RegistrationStatus.PENDING, RegistrationStatus.EXPIRED] } },
      data: { status: RegistrationStatus.CONFIRMED, holdExpiresAt: null, cartToken: null },
    })
    await tx.voucher.updateMany({ where: { bookingId }, data: { usedAt: at } })
    return { claimed: true, conflict: null }
  }, TX_OPTIONS)

  if (!outcome.claimed) return { alreadyPaid: true }

  if (outcome.conflict) {
    await refundUnfulfilledPayment(bookingId, info, outcome.conflict)
    return { alreadyPaid: false, conflict: outcome.conflict }
  }

  if (lapsed) console.info('[booking] 逾時後付款，名額與時段仍有效，已正常成立', booking.code)
  await sendConfirmationNotification(bookingId)
  return { alreadyPaid: false }
}

/** 付款成功但無法履約：嘗試原路退款；不支援或失敗時維持 REFUND_PENDING 由後台處理 */
async function refundUnfulfilledPayment(bookingId: string, info: PaidInfo, reason: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } })
  if (!booking) return
  let refunded = info.amount === 0
  if (!refunded && info.provider !== 'internal') {
    const provider = getPaymentProvider(info.provider)
    if (provider.refund) {
      try {
        const res = await provider.refund(info.providerRef, info.amount)
        refunded = res.ok
      } catch (err) {
        console.error('[booking] 自動退款失敗', err)
      }
    }
  }
  if (refunded) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { bookingId, providerRef: info.providerRef, status: 'SUCCESS' },
        data: { status: 'REFUNDED', refundedAt: now() },
      })
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', cancelledAt: now() } })
    })
  }
  if (booking.user.lineUserId) {
    await pushMessages(booking.user.lineUserId, [
      {
        type: 'text',
        text: refunded
          ? `訂單 ${booking.code} 付款完成時，${reason}，無法成立。款項已申請退回原付款方式。`
          : `訂單 ${booking.code} 付款完成時，${reason}，無法成立。場館將盡快為您辦理退款。`,
      },
    ]).catch(() => {})
  }
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
      include: {
        user: true,
        venue: true,
        items: { orderBy: { startsAt: 'asc' } },
        activityItems: { orderBy: { startsAt: 'asc' } },
      },
    })
    if (!booking?.user.lineUserId) return

    if (booking.items.length > 0) {
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
    }
    if (booking.activityItems.length > 0) {
      const lines = booking.activityItems.map((it) => {
        const d = taipeiDateString(it.startsAt)
        const base = taipeiToUtc(d, 0).getTime()
        const s = Math.round((it.startsAt.getTime() - base) / 60_000)
        const e = Math.round((it.endsAt.getTime() - base) / 60_000)
        return `・${it.title} ${d} ${activityTimeLabel(s, e)} × ${it.quantity}`
      })
      await pushMessages(booking.user.lineUserId, [
        { type: 'text', text: `【${booking.venue.name}】活動報名完成（訂單 ${booking.code}）\n${lines.join('\n')}` },
      ])
    }
  } catch (err) {
    // 通知失敗不影響訂單成立
    console.error('[booking] LINE 通知失敗', err)
  }
}

/* ────────────────────────────── 取消與逾時 ────────────────────────────── */

/** 取消訂單（場地與活動一起）。實付金額優先原路退回，不支援時改為點數；退款記入退款帳 */
export async function cancelBooking(
  bookingId: string,
  actorUserId: string | null,
  opts: { asAdmin?: boolean; fullRefund?: boolean } = {},
): Promise<{ refundPoints: number; ratio: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: { orderBy: { startsAt: 'asc' } },
      activityItems: { orderBy: { startsAt: 'asc' } },
      user: true,
      payments: true,
    },
  })
  if (!booking) throw new BookingError('找不到訂單', 'NOT_FOUND')
  if (!opts.asAdmin && booking.userId !== actorUserId) throw new BookingError('無權限操作此訂單', 'UNAUTHORIZED')
  if (booking.status === 'CANCELLED') throw new BookingError('訂單已取消')
  if (booking.status === 'COMPLETED') throw new BookingError('訂單已完成，無法取消')
  if (booking.status === 'REFUND_PENDING') throw new BookingError('此訂單正在等待退款，請洽場館')
  if (booking.refundStatus === 'PROCESSING') throw new BookingError('此訂單有退款正在處理，請稍後再試')

  const starts = [...booking.items.map((i) => i.startsAt), ...booking.activityItems.map((i) => i.startsAt)]
  const firstStart = starts.sort((a, b) => a.getTime() - b.getTime())[0] ?? now()
  const hoursBefore = (firstStart.getTime() - now().getTime()) / 3_600_000
  const ratio = opts.fullRefund || opts.asAdmin ? 1 : refundRatio(hoursBefore)
  const late = ratio < 1

  // 可退基礎：扣掉先前已逐項退過的部分，避免重複退款
  const refundedPointsBefore =
    booking.items.reduce((s, i) => s + i.refundedPoints, 0) + booking.activityItems.reduce((s, i) => s + i.refundedPoints, 0)
  const paid = booking.status === 'PAID'
  const cashBase = paid ? Math.max(0, booking.total - booking.refundedAmount) : 0
  const pointsBase = Math.max(0, booking.pointsUsed - refundedPointsBefore)
  const cashRefund = Math.round(cashBase * ratio)
  const pointsRefund = Math.round(pointsBase * ratio)

  // 1. 取消並釋放時段與活動名額（歷史保留於明細）
  await prisma.$transaction(async (tx) => {
    const claim = await tx.booking.updateMany({
      where: { id: bookingId, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'CANCELLED', cancelledAt: now(), expiresAt: null },
    })
    if (claim.count === 0) throw new BookingError('訂單狀態已變更，請重新整理')
    await tx.reservation.deleteMany({ where: { bookingId } })
    await tx.sessionRegistration.updateMany({
      where: { bookingId, status: { in: [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED] } },
      data: {
        status: late ? RegistrationStatus.LATE_CANCEL : RegistrationStatus.CANCELLED,
        cancelledAt: now(),
        holdExpiresAt: null,
        cartToken: null,
      },
    })
    await tx.bookingItem.updateMany({ where: { bookingId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })
    await tx.bookingActivityItem.updateMany({ where: { bookingId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })
    // 未使用完成的折價券歸還
    await tx.voucher.updateMany({ where: { bookingId }, data: { bookingId: null, usedAt: null } })
  }, TX_OPTIONS)

  // 2. 實付金額優先原路退回；金流不支援或失敗才改為點數（不會兩邊都退）
  let method: 'ORIGINAL' | 'POINTS' = 'POINTS'
  let providerRef: string | null = null
  const successPayment = booking.payments.find((p) => p.status === 'SUCCESS' && p.providerRef)
  if (cashRefund > 0 && successPayment && successPayment.provider !== 'internal' && !(await isDemoTenant())) {
    const provider = getPaymentProvider(successPayment.provider)
    if (provider.refund) {
      try {
        const result = await provider.refund(successPayment.providerRef as string, cashRefund)
        if (result.ok) {
          method = 'ORIGINAL'
          providerRef = result.providerRef ?? null
        }
      } catch (err) {
        console.error('[booking] 金流退款失敗，改以點數回補', err)
      }
    }
  }
  const creditPoints = pointsRefund + (method === 'POINTS' ? cashRefund : 0)

  // 3. 記入退款帳：逐項分攤，之後不會再被重複退
  await prisma.$transaction(async (tx) => {
    if (creditPoints > 0) await applyPoints(tx, { userId: booking.userId, delta: creditPoints, kind: 'REFUND', reason: `訂單 ${booking.code} 取消退款回補`, actor: actorUserId ? (opts.asAdmin ? actorUserId : `user:${actorUserId}`) : 'system', idempotencyKey: `cancel:${booking.id}:points`, bookingId: booking.id })
    if (cashRefund > 0 || pointsRefund > 0) {
      const lines = [
        ...booking.items.map((i) => ({ type: 'COURT' as const, id: i.id, gross: i.price, label: `場地 ${i.courtName}` })),
        ...booking.activityItems.map((i) => ({ type: 'ACTIVITY' as const, id: i.id, gross: i.amount, label: `活動 ${i.title}` })),
      ]
      const split = (total: number) => {
        const sum = lines.reduce((s, l) => s + l.gross, 0)
        if (sum <= 0 || total <= 0) return lines.map(() => 0)
        const out = lines.map((l) => Math.floor((total * l.gross) / sum))
        out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
        return out
      }
      const cashParts = split(cashRefund)
      const pointParts = split(pointsRefund)
      await tx.refund.create({
        data: {
          bookingId,
          idempotencyKey: `cancel-${bookingId}`,
          status: 'SUCCEEDED',
          method,
          cashAmount: cashRefund,
          pointsAmount: pointsRefund,
          reason: opts.asAdmin ? '後台取消訂單' : `會員取消（退款比例 ${Math.round(ratio * 100)}%）`,
          cancelItems: true,
          provider: successPayment?.provider ?? null,
          providerRef,
          createdBy: opts.asAdmin ? `admin:${actorUserId ?? 'system'}` : `user:${actorUserId ?? 'system'}`,
          completedAt: now(),
          note: method === 'POINTS' && cashRefund > 0 ? '實付金額以點數回補' : null,
          items: {
            create: lines.map((l, i) => ({ itemType: l.type, itemId: l.id, label: l.label, cashAmount: cashParts[i], pointsAmount: pointParts[i] })),
          },
        },
      })
      for (const [i, l] of lines.entries()) {
        const data = { refundedAmount: { increment: cashParts[i] }, refundedPoints: { increment: pointParts[i] } }
        if (l.type === 'COURT') await tx.bookingItem.update({ where: { id: l.id }, data })
        else await tx.bookingActivityItem.update({ where: { id: l.id }, data })
      }
      await tx.booking.update({ where: { id: bookingId }, data: { refundedAmount: { increment: cashRefund } } })
      if (method === 'ORIGINAL' && successPayment && cashRefund >= booking.total) {
        await tx.payment.update({ where: { id: successPayment.id }, data: { status: 'REFUNDED', refundedAt: now() } })
      }
    }
    await tx.auditLog.create({
      data: {
        actor: opts.asAdmin ? `admin:${actorUserId ?? 'system'}` : `user:${actorUserId ?? 'system'}`,
        action: 'BOOKING_CANCELLED',
        target: booking.code,
        detail: { ratio, cashRefund, pointsRefund, method, status: booking.status },
      },
    })
    await syncRefundStatus(tx, bookingId)
  }, TX_OPTIONS)

  await notifySeatWatchers(booking.activityItems.map((i) => i.sessionId)).catch(() => {})
  await notifyBookingCancelled(booking.user.lineUserId, booking.code, creditPoints)
  return { refundPoints: creditPoints, ratio }
}

/**
 * 將逾時未付款的訂單標記為 EXPIRED 並釋放時段與活動名額。
 * 由 /api/cron/expire-bookings 定期呼叫，讀取訂單時也會惰性觸發。
 * （名額計算本身已排除逾時暫留，所以排程晚跑也不會讓名額被永久佔用。）
 */
export async function expireStaleBookings(): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now() } },
    select: { id: true, pointsUsed: true, userId: true, activityItems: { select: { sessionId: true } } },
  })
  if (stale.length === 0) return 0

  let expired = 0
  for (const b of stale) {
    const done = await prisma.$transaction(async (tx) => {
      const claim = await tx.booking.updateMany({ where: { id: b.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
      if (claim.count === 0) return false
      await tx.reservation.deleteMany({ where: { bookingId: b.id } })
      await tx.sessionRegistration.updateMany({
        where: { bookingId: b.id, status: RegistrationStatus.PENDING },
        data: { status: RegistrationStatus.EXPIRED, holdExpiresAt: null, cartToken: null },
      })
      await tx.voucher.updateMany({ where: { bookingId: b.id }, data: { bookingId: null, usedAt: null } })
      if (b.pointsUsed > 0) {
        await applyPoints(tx, { userId: b.userId, delta: b.pointsUsed, kind: 'RELEASE', reason: `訂單 ${b.id.slice(-6)} 逾時未付款，歸還折抵點數`, actor: 'system', idempotencyKey: `expire:${b.id}`, bookingId: b.id })
      }
      return true
    }, TX_OPTIONS)
    if (done) expired++
  }
  await notifySeatWatchers(stale.flatMap((b) => b.activityItems.map((i) => i.sessionId))).catch(() => {})
  return expired
}

/** 將已結束的訂單標記為完成（場地與活動都結束才算） */
export async function completePastBookings(): Promise<number> {
  const at = now()
  const res = await prisma.booking.updateMany({
    where: {
      status: 'PAID',
      items: { every: { endsAt: { lt: at } } },
      activityItems: { every: { endsAt: { lt: at } } },
      OR: [{ items: { some: {} } }, { activityItems: { some: {} } }],
    },
    data: { status: 'COMPLETED' },
  })
  return res.count
}

/* ────────────────────────────── 查詢 ────────────────────────────── */

function activityItemView<T extends { startsAt: Date; endsAt: Date }>(it: T) {
  const d = taipeiDateString(it.startsAt)
  const base = taipeiToUtc(d, 0).getTime()
  const s = Math.round((it.startsAt.getTime() - base) / 60_000)
  const e = Math.round((it.endsAt.getTime() - base) / 60_000)
  return { ...it, date: d, timeLabel: activityTimeLabel(s, e) }
}

export async function getBookingDetail(bookingId: string, userId: string | null, asAdmin = false) {
  await expireStaleBookings()

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      venue: true,
      items: { orderBy: { startsAt: 'asc' } },
      activityItems: { orderBy: { startsAt: 'asc' } },
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
    activityViews: booking.activityItems.map(activityItemView),
  }
}

export async function listUserBookings(userId: string) {
  await expireStaleBookings()

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      venue: true,
      items: { orderBy: { startsAt: 'asc' } },
      activityItems: { orderBy: { startsAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const today = taipeiDateString()
  const isLive = (s: string) => s === 'PAID' || s === 'PENDING' || s === 'REFUND_PENDING'
  return {
    upcoming: bookings.filter((b) => isLive(b.status) && b.playDate >= today),
    past: bookings.filter((b) => b.status === 'COMPLETED' || (b.status === 'PAID' && b.playDate < today)),
    cancelled: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'EXPIRED'),
    all: bookings,
  }
}

export { getCart }
