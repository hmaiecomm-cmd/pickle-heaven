import 'server-only'
import { prisma } from './db'
import { resolveRate } from './pricing'
import {
  addDays,
  diffDays,
  formatRange,
  now,
  slotStarts,
  taipeiDateString,
  taipeiMinuteOfDay,
  taipeiToUtc,
} from './time'
import type { AvailabilityDTO, CartDTO, CartItemDTO, SlotState, TimeRowDTO } from './types'

/**
 * 清除逾時的購物車暫扣。
 * 於每次讀取可用性與建立暫扣前呼叫，確保「他人暫扣」不會永久卡位。
 */
export async function releaseExpiredHolds(): Promise<number> {
  const res = await prisma.reservation.deleteMany({
    where: { status: 'HELD', holdExpiresAt: { lt: now() } },
  })
  return res.count
}

export class BookingWindowError extends Error {
  code = 'BOOKING_CLOSED' as const
}

/** 檢查日期是否在可預約範圍內 */
export function assertBookableDate(dateStr: string, bookAheadDays: number): void {
  const today = taipeiDateString()
  const offset = diffDays(today, dateStr)
  if (offset < 0) throw new BookingWindowError('無法預約已過去的日期')
  if (offset > bookAheadDays) throw new BookingWindowError(`僅開放預約未來 ${bookAheadDays} 天內的時段`)
}

/**
 * 產生某場館某日的「場地 × 時段」矩陣。
 * cartToken 用來區分「已選取」（自己）與「他人暫扣」。
 */
export async function getAvailability(
  slug: string,
  dateStr: string,
  cartToken: string | null,
): Promise<AvailabilityDTO> {
  await releaseExpiredHolds()

  const venue = await prisma.venue.findUnique({
    where: { slug },
    include: {
      courts: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      priceRules: true,
    },
  })
  if (!venue) throw new Error(`找不到場館：${slug}`)

  const starts = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes)

  const times: TimeRowDTO[] = starts.map((start) => {
    const end = start + venue.slotMinutes
    const rate = resolveRate(dateStr, start, venue.priceRules)
    return {
      start,
      end,
      label: formatRange(start, end),
      rateName: rate.name,
      kind: rate.kind,
      price: rate.price,
    }
  })

  const dayStart = taipeiToUtc(dateStr, venue.openMinute)
  const dayEnd = taipeiToUtc(dateStr, venue.closeMinute)

  const reservations = await prisma.reservation.findMany({
    where: {
      courtId: { in: venue.courts.map((c) => c.id) },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: { courtId: true, startsAt: true, status: true, cartToken: true },
  })

  // 以 "courtId@startMs" 建索引，供矩陣查表
  const taken = new Map<string, { status: string; cartToken: string | null }>()
  for (const r of reservations) {
    taken.set(`${r.courtId}@${r.startsAt.getTime()}`, { status: r.status, cartToken: r.cartToken })
  }

  const today = taipeiDateString()
  const isToday = dateStr === today
  const isPastDate = diffDays(today, dateStr) < 0
  const nowMinute = taipeiMinuteOfDay()
  const maxDate = addDays(today, venue.bookAheadDays)
  const beyondWindow = diffDays(dateStr, maxDate) < 0

  const cells: SlotState[][] = times.map((t) =>
    venue.courts.map((court): SlotState => {
      const hit = taken.get(`${court.id}@${taipeiToUtc(dateStr, t.start).getTime()}`)
      if (hit) {
        if (hit.status === 'BOOKED') return 'BOOKED'
        if (hit.status === 'BLOCKED') return 'BLOCKED'
        // HELD：自己的購物車顯示為已選取，其餘為他人暫扣
        return cartToken && hit.cartToken === cartToken ? 'SELECTED' : 'HELD'
      }
      if (isPastDate) return 'PAST'
      if (isToday && t.start <= nowMinute) return 'PAST'
      if (beyondWindow) return 'CLOSED'
      return 'AVAILABLE'
    }),
  )

  return {
    venue: {
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      address: venue.address,
      phone: venue.phone,
      notice: venue.notice,
      policy: venue.policy,
      slotMinutes: venue.slotMinutes,
      holdMinutes: venue.holdMinutes,
      bookAheadDays: venue.bookAheadDays,
    },
    date: dateStr,
    courts: venue.courts.map((c) => ({
      id: c.id,
      name: c.name,
      indoor: c.indoor,
      covered: c.covered,
      surface: c.surface,
    })),
    times,
    cells,
    generatedAt: new Date().toISOString(),
  }
}

/** 讀取目前購物車（尚未逾時的暫扣） */
export async function getCart(cartToken: string | null): Promise<CartDTO> {
  if (!cartToken) return { items: [], subtotal: 0, expiresAt: null }

  await releaseExpiredHolds()

  const rows = await prisma.reservation.findMany({
    // bookingId 為 null 才算「還在購物車裡」；
    // 已建立待付款訂單的暫扣屬於該筆訂單，不應再出現在購物車。
    where: { cartToken, status: 'HELD', bookingId: null },
    orderBy: { startsAt: 'asc' },
    include: { court: { include: { venue: { include: { priceRules: true } } } } },
  })

  const items: CartItemDTO[] = rows.map((r) => {
    // 跨日時段（例如 00:00–01:00）在營業邏輯上仍屬前一天的場次
    let dateStr = taipeiDateString(r.startsAt)
    let start = minuteOfDayFromUtc(r.startsAt, dateStr)
    if (start < r.court.venue.openMinute) {
      dateStr = addDays(dateStr, -1)
      start += 1440
    }
    const end = start + Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000)
    const rate = resolveRate(dateStr, start, r.court.venue.priceRules)
    return {
      reservationId: r.id,
      courtId: r.courtId,
      courtName: r.court.name,
      date: dateStr,
      start,
      end,
      timeLabel: formatRange(start, end),
      rateName: rate.name,
      price: rate.price,
      expiresAt: (r.holdExpiresAt ?? new Date()).toISOString(),
    }
  })

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)
  const expiresAt =
    items.length > 0
      ? items.map((i) => i.expiresAt).sort()[0]
      : null

  return { items, subtotal, expiresAt }
}

/**
 * 由 UTC 時間推回「相對於指定台北日期」的分鐘數。
 * 跨日時段（例如 23:00–00:00 之後的 00:00–01:00）會回傳 >= 1440 的值。
 */
function minuteOfDayFromUtc(date: Date, baseDateStr: string): number {
  const base = taipeiToUtc(baseDateStr, 0).getTime()
  return Math.round((date.getTime() - base) / 60000)
}
