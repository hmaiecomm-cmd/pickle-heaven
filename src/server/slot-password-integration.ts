/**
 * 時段密碼與訂單流程的整合（可重複執行、具冪等性）
 *
 * syncSlotPasswordsForBooking(bookingId) 依訂單「目前狀態」對齊它應有的時段密碼資格：
 * - 已付款（PAID／COMPLETED）：依業主規則找出所屬時段 → 沿用該時段既有密碼或建立新密碼 →
 *   加入有效訂單 → 只對新加入的時段經 LINE 發送密碼。
 * - 取消、退款、付款失敗、逾時（非 PAID／COMPLETED）：移除這筆訂單的所有時段資格，
 *   重新計算各時段有效訂單數；共用密碼不刪除，時段沒有任何有效訂單時才鎖定。
 * - 改期（明細時間改變）：舊時段移除並重算（無其他有效訂單即鎖定），新時段加入或建立，只發新時段密碼。
 *
 * 付款成功、取消、退款、付款失敗、後台取消活動都會呼叫；排程也會定期補跑（付款當下失敗時可補上）。
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import {
  AHEAD_DAYS_MAX,
  AHEAD_DAYS_MIN,
  computeStatus,
  effectiveMode,
  ensureSlot,
  expireOffsetMinutes,
  getOrCreateRule,
  recountSlot,
  slotKeyFor,
  VALID_BOOKING_STATUSES,
  type SlotKey,
} from './slot-password-service'
import { retryFailedSlotPasswordLogs, sendSlotPasswordToBooking, type PushFn } from './slot-password-notification'

export interface SyncOptions {
  at?: Date
  send?: PushFn
}

export interface SyncSummary {
  added: string[]
  removed: string[]
  kept: string[]
  sent: number
  sendFailed: number
}

type Group = { key: SlotKey; itemStartAt: Date; itemEndAt: Date }

export async function syncSlotPasswordsForBooking(bookingId: string, opts: SyncOptions = {}): Promise<SyncSummary> {
  const at = opts.at ?? now()
  const summary: SyncSummary = { added: [], removed: [], kept: [], sent: 0, sendFailed: 0 }
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      code: true,
      status: true,
      venueId: true,
      items: { where: { status: 'ACTIVE' }, select: { startsAt: true, endsAt: true } },
      activityItems: { where: { status: 'ACTIVE' }, select: { startsAt: true, endsAt: true } },
    },
  })
  if (!booking) return summary

  const valid = (VALID_BOOKING_STATUSES as readonly string[]).includes(booking.status)
  const rule = await getOrCreateRule(booking.venueId)
  const mode = effectiveMode(rule)

  // 這筆訂單「應該」在哪些時段（無效訂單 → 一個都沒有）
  const groups = new Map<string, Group>()
  if (valid) {
    for (const it of [...booking.items, ...booking.activityItems]) {
      // 已經結束（含失效緩衝）的明細不再產生密碼
      if (it.endsAt.getTime() + expireOffsetMinutes(rule) * 60_000 <= at.getTime()) continue
      const key = slotKeyFor(it.startsAt, mode, booking.code)
      const id = `${key.slotDate}|${key.slotType}`
      const g = groups.get(id)
      if (!g) groups.set(id, { key, itemStartAt: it.startsAt, itemEndAt: it.endsAt })
      else {
        if (it.startsAt < g.itemStartAt) g.itemStartAt = it.startsAt
        if (it.endsAt > g.itemEndAt) g.itemEndAt = it.endsAt
      }
    }
  }

  const links = await prisma.bookingSlotPassword.findMany({ where: { bookingId }, include: { slotPassword: true } })

  // 已有的資格：時間相同就保留（業主中途改規則不影響已發出的密碼）；其餘視為取消或改期而移除
  const satisfied = new Set<string>()
  const touched = new Set<string>()
  for (const link of links) {
    const match = [...groups.entries()].find(
      ([id, g]) =>
        !satisfied.has(id) &&
        g.itemStartAt.getTime() === link.itemStartAt.getTime() &&
        g.itemEndAt.getTime() === link.itemEndAt.getTime() &&
        link.slotPassword.status !== 'CANCELLED',
    )
    if (match) {
      satisfied.add(match[0])
      summary.kept.push(link.slotPasswordId)
      touched.add(link.slotPasswordId)
      continue
    }
    await prisma.bookingSlotPassword.delete({ where: { id: link.id } })
    summary.removed.push(link.slotPasswordId)
    touched.add(link.slotPasswordId)
  }

  // 新加入的時段
  const toNotify: string[] = []
  for (const [id, g] of groups) {
    if (satisfied.has(id)) continue
    const { slot } = await ensureSlot(booking.venueId, rule, g.key, at)
    await prisma.bookingSlotPassword.upsert({
      where: { bookingId_slotPasswordId: { bookingId, slotPasswordId: slot.id } },
      create: { bookingId, slotPasswordId: slot.id, itemStartAt: g.itemStartAt, itemEndAt: g.itemEndAt },
      update: { itemStartAt: g.itemStartAt, itemEndAt: g.itemEndAt },
    })
    summary.added.push(slot.id)
    touched.add(slot.id)
    toNotify.push(slot.id)
  }

  // 重新計算有效訂單數、開放／失效時間與狀態（無有效訂單 → LOCKED）
  for (const slotId of touched) await recountSlot(slotId, at)

  // 只發給這筆訂單新加入的時段（不會重發給同時段其他顧客）
  for (const slotId of toNotify) {
    const r = await sendSlotPasswordToBooking(slotId, bookingId, { send: opts.send })
    if (r.ok) summary.sent++
    else summary.sendFailed++
  }
  return summary
}

/** 給訂單流程呼叫：密碼處理失敗不能影響付款、取消或退款本身 */
export async function syncSlotPasswordsForBookingSafe(bookingId: string): Promise<void> {
  try {
    await syncSlotPasswordsForBooking(bookingId)
  } catch (err) {
    console.error('[slot-password] 同步時段密碼失敗', bookingId, err)
  }
}

/**
 * 批次預先產生：未來 N 天（依各場館規則，1～30 天）內已付款、但尚未取得時段密碼的訂單。
 * 冪等：同一場館＋日期＋時段只有一組密碼（資料庫唯一鍵），重複執行不會產生第二組；
 * 未付款、取消、退款的訂單不會加入。
 */
export async function generateUpcomingSlotPasswords(
  opts: SyncOptions & { limit?: number; venueId?: string } = {},
): Promise<{ checked: number; added: number }> {
  const at = opts.at ?? now()
  const rules = await prisma.slotPasswordRule.findMany({ select: { venueId: true, generateAheadDays: true } })
  const aheadByVenue = new Map(rules.map((r) => [r.venueId, Math.min(AHEAD_DAYS_MAX, Math.max(AHEAD_DAYS_MIN, r.generateAheadDays))]))
  const maxAhead = Math.max(7, ...aheadByVenue.values())
  const horizon = new Date(at.getTime() + maxAhead * 86_400_000)

  const bookings = await prisma.booking.findMany({
    where: {
      ...(opts.venueId ? { venueId: opts.venueId } : {}),
      status: { in: [...VALID_BOOKING_STATUSES] },
      slotPasswords: { none: {} },
      OR: [
        { items: { some: { status: 'ACTIVE', endsAt: { gt: at }, startsAt: { lte: horizon } } } },
        { activityItems: { some: { status: 'ACTIVE', endsAt: { gt: at }, startsAt: { lte: horizon } } } },
      ],
    },
    select: { id: true, venueId: true, items: { where: { status: 'ACTIVE' }, select: { startsAt: true } }, activityItems: { where: { status: 'ACTIVE' }, select: { startsAt: true } } },
    orderBy: { paidAt: 'asc' },
    take: opts.limit ?? 200,
  })

  let added = 0
  for (const b of bookings) {
    const ahead = aheadByVenue.get(b.venueId) ?? 7
    const limit = at.getTime() + ahead * 86_400_000
    const first = Math.min(...[...b.items, ...b.activityItems].map((i) => i.startsAt.getTime()))
    if (first > limit) continue
    try {
      added += (await syncSlotPasswordsForBooking(b.id, opts)).added.length
    } catch (err) {
      console.error('[slot-password] 批次產生失敗', b.id, err)
    }
  }
  return { checked: bookings.length, added }
}

/** 依時間推進狀態：SCHEDULED → ACTIVE → EXPIRED（LOCKED 到期也改為 EXPIRED） */
export async function refreshSlotStatuses(at: Date = now()): Promise<number> {
  const due = await prisma.slotPassword.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED', openAt: { lte: at } },
        { status: { in: ['SCHEDULED', 'ACTIVE', 'LOCKED'] }, expireAt: { lte: at } },
      ],
    },
    include: { rule: true },
    take: 500,
  })
  let changed = 0
  for (const s of due) {
    if (computeStatus(s, s.rule, at) === s.status) continue
    await recountSlot(s.id, at)
    changed++
  }
  return changed
}

/** 排程入口：狀態推進 → 批次補產生 → 重試失敗的 LINE 發送 */
export async function runSlotPasswordMaintenance(opts: SyncOptions = {}) {
  const at = opts.at ?? now()
  const statusChanged = await refreshSlotStatuses(at)
  const batch = await generateUpcomingSlotPasswords({ ...opts, at })
  const retry = await retryFailedSlotPasswordLogs({ send: opts.send, at })
  return { statusChanged, batch, retry }
}
