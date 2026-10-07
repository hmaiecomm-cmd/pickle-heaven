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
import type { AvailabilityDTO, CartActivityItemDTO, CartDTO, CartItemDTO, SlotState, TimeRowDTO } from './types'
import { ACTIVITY_TYPE_LABEL, activityTimeLabel, PRICE_UNIT_LABEL, shortDateLabel } from './activity-shared'
import type { ActivityTypeKey, PriceUnitKey } from './activity-shared'
import { getSessionsForDate, notifySeatWatchers } from '@/server/activity-service'

/**
 * 清除逾時的購物車暫扣。
 * 於每次讀取可用性與建立暫扣前呼叫，確保「他人暫扣」不會永久卡位。
 */
export async function releaseExpiredHolds(): Promise<number> {
  const at = now()
  const res = await prisma.reservation.deleteMany({
    // HELD：購物車暫扣；EVENT 且有到期時間：活動草稿的「保留場地」
    where: { status: { in: ['HELD', 'EVENT'] }, holdExpiresAt: { lt: at } },
  })

  // 活動的購物車暫留逾時（尚未成立訂單者）。已成立待付款訂單的由 expireStaleBookings 處理。
  const expired = await prisma.sessionRegistration.findMany({
    where: { status: 'PENDING', bookingId: null, holdExpiresAt: { lt: at } },
    select: { id: true, sessionId: true },
    take: 500,
  })
  if (expired.length > 0) {
    await prisma.sessionRegistration.updateMany({
      where: { id: { in: expired.map((r) => r.id) }, status: 'PENDING', bookingId: null },
      data: { status: 'EXPIRED', cartToken: null },
    })
    await notifySeatWatchers(expired.map((r) => r.sessionId)).catch((err) => console.error('[seat-alert]', err))
  }
  return res.count + expired.length
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
  userId: string | null = null,
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

  // 以伺服器時間與場館時區判斷，不依客人的裝置時間；跨午夜時段用完整日期時間比較
  const nowMs = now().getTime()
  const startMs = (minute: number) => taipeiToUtc(dateStr, minute).getTime()
  const cutoffMs = venue.bookingCutoffMinutes * 60_000

  const allTimes: TimeRowDTO[] = starts.map((start) => {
    const end = start + venue.slotMinutes
    const rate = resolveRate(dateStr, start, venue.priceRules)
    return {
      start,
      end,
      label: formatRange(start, end),
      rateName: rate.name,
      kind: rate.kind,
      price: rate.price,
      nextDay: start >= 1440,
    }
  })
  // 已結束的時段整列隱藏（含時間欄與所有場地欄）
  const times = allTimes.filter((t) => startMs(t.end) > nowMs)
  const hiddenEndedRows = allTimes.length - times.length

  const dayStart = taipeiToUtc(dateStr, venue.openMinute)
  const dayEnd = taipeiToUtc(dateStr, venue.closeMinute)

  const reservations = await prisma.reservation.findMany({
    where: {
      courtId: { in: venue.courts.map((c) => c.id) },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: { courtId: true, startsAt: true, status: true, cartToken: true, sessionId: true, holdExpiresAt: true },
  })

  const events = await getSessionsForDate(venue.id, dateStr, userId)
  const visibleEventIds = new Set(events.map((e) => e.id))

  // 以 "courtId@startMs" 建索引，供矩陣查表
  const taken = new Map<string, { status: string; cartToken: string | null; sessionId: string | null; draft: boolean }>()
  for (const r of reservations) {
    taken.set(`${r.courtId}@${r.startsAt.getTime()}`, {
      status: r.status,
      cartToken: r.cartToken,
      sessionId: r.sessionId,
      draft: r.status === 'EVENT' && r.holdExpiresAt !== null,
    })
  }

  const today = taipeiDateString()
  const maxDate = addDays(today, venue.bookAheadDays)
  const beyondWindow = diffDays(dateStr, maxDate) < 0

  const cellSessions: (string | null)[][] = times.map(() => venue.courts.map(() => null))
  const cells: SlotState[][] = times.map((t, rowIdx) =>
    venue.courts.map((court, colIdx): SlotState => {
      const hit = taken.get(`${court.id}@${taipeiToUtc(dateStr, t.start).getTime()}`)
      if (hit) {
        if (hit.status === 'EVENT') {
          // 已發布活動顯示活動區塊；草稿保留或未公開的場次只顯示「場館保留」
          if (!hit.draft && hit.sessionId && visibleEventIds.has(hit.sessionId)) {
            cellSessions[rowIdx][colIdx] = hit.sessionId
            return 'EVENT'
          }
          return 'RESERVED'
        }
        if (hit.status === 'BOOKED') return 'BOOKED'
        if (hit.status === 'BLOCKED') return 'BLOCKED'
        // HELD：自己的購物車顯示為已選取，其餘為他人暫扣
        return cartToken && hit.cartToken === cartToken ? 'SELECTED' : 'HELD'
      }
      if (startMs(t.start) <= nowMs) return 'STARTED'
      if (startMs(t.start) - cutoffMs <= nowMs) return 'CUTOFF'
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
      bookingCutoffMinutes: venue.bookingCutoffMinutes,
    },
    date: dateStr,
    serverNow: new Date(nowMs).toISOString(),
    hiddenEndedRows,
    allEnded: allTimes.length > 0 && times.length === 0,
    nextDate: addDays(dateStr, 1),
    courts: venue.courts.map((c) => ({
      id: c.id,
      name: c.name,
      indoor: c.indoor,
      covered: c.covered,
      surface: c.surface,
    })),
    times,
    cells,
    cellSessions,
    events,
    generatedAt: new Date().toISOString(),
  }
}

/** 讀取目前購物車（尚未逾時的暫扣） */
export async function getCart(cartToken: string | null): Promise<CartDTO> {
  if (!cartToken) return { items: [], activityItems: [], subtotal: 0, expiresAt: null, invalidCount: 0 }

  await releaseExpiredHolds()
  const nowMs = now().getTime()

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
      invalid: slotInvalidReason(r.startsAt.getTime(), r.court.venue.bookingCutoffMinutes, nowMs),
    }
  })

  const activityItems = await getCartActivityItems(cartToken, nowMs)

  const subtotal = items.reduce((sum, i) => sum + i.price, 0) + activityItems.reduce((sum, i) => sum + i.amount, 0)
  const all = [...items.map((i) => i.expiresAt), ...activityItems.map((i) => i.expiresAt)]
  const expiresAt = all.length > 0 ? all.sort()[0] : null

  const invalidCount = items.filter((i) => i.invalid).length + activityItems.filter((i) => i.invalid).length

  return { items, activityItems, subtotal, expiresAt, invalidCount }
}

/** 場地時段是否已不能結帳：已開始，或已超過預約截止時間 */
export function slotInvalidReason(startsAtMs: number, cutoffMinutes: number, nowMs = now().getTime()): string | null {
  if (startsAtMs <= nowMs) return '時段已開始'
  if (startsAtMs - cutoffMinutes * 60_000 <= nowMs) return '已超過預約截止時間'
  return null
}

/** 購物車中的活動報名；金額依場次目前價格計算，結帳時伺服器再算一次 */
async function getCartActivityItems(cartToken: string, nowMs: number): Promise<CartActivityItemDTO[]> {
  const regs = await prisma.sessionRegistration.findMany({
    where: { cartToken, status: 'PENDING', bookingId: null, holdExpiresAt: { gt: now() } },
    include: {
      session: {
        include: { activity: true, courts: { include: { court: { select: { name: true, sortOrder: true } } } } },
      },
    },
    orderBy: { session: { startAt: 'asc' } },
  })
  return regs.map((r) => {
    const s = r.session
    const date = taipeiDateString(s.startAt)
    const start = taipeiMinuteOfDay(s.startAt)
    const end = start + Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000)
    const unit = (s.activity?.priceUnit ?? 'PER_PERSON') as PriceUnitKey
    return {
      registrationId: r.id,
      sessionId: s.id,
      title: s.title,
      typeLabel: ACTIVITY_TYPE_LABEL[(s.activity?.type ?? 'OPEN_PLAY') as ActivityTypeKey],
      date,
      dateLabel: shortDateLabel(date),
      timeLabel: activityTimeLabel(start, end),
      courtNames: [...s.courts].sort((a, b) => a.court.sortOrder - b.court.sortOrder).map((c) => c.court.name),
      quantity: r.quantity,
      unitLabel: PRICE_UNIT_LABEL[unit],
      unitPrice: s.price,
      amount: s.price * r.quantity,
      expiresAt: (r.holdExpiresAt ?? new Date()).toISOString(),
      // 活動是否仍可報名由各場次自己的截止規則決定（結帳時再驗證）；這裡只擋已開始或已取消的場次
      invalid: s.status === 'CANCELLED' ? '活動已取消' : s.startAt.getTime() <= nowMs ? '活動已開始' : null,
    }
  })
}

/**
 * 由 UTC 時間推回「相對於指定台北日期」的分鐘數。
 * 跨日時段（例如 23:00–00:00 之後的 00:00–01:00）會回傳 >= 1440 的值。
 */
function minuteOfDayFromUtc(date: Date, baseDateStr: string): number {
  const base = taipeiToUtc(baseDateStr, 0).getTime()
  return Math.round((date.getTime() - base) / 60000)
}
