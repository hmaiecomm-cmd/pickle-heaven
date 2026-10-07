import 'server-only'
import { Prisma, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { canPush, pushMessages } from '@/lib/line'
import {
  ACTIVITY_TYPE_LABEL,
  activityTimeLabel,
  PRICE_UNIT_LABEL,
  seatsPerUnit,
  shortDateLabel,
  SIGNUP_STATE_LABEL,
  type ActivitySessionDTO,
  type ActivityTypeKey,
  type PriceUnitKey,
  type SignupState,
} from '@/lib/activity-shared'
import { addDays, formatMinute, now, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { activeRestrictions } from './member-restrictions'

/**
 * 前台活動：查詢場次、即時名額、加入購物車（暫留名額）、有名額通知。
 *
 * 名額 = 一般報名名額（capacity − reservedCapacity）
 *      −（已確認的報名 + 尚未到期的購物車暫留／待付款）
 * 報名狀態一律依時間與名額即時計算；排程每日只跑一次，不能依賴 Session.status 的 OPEN / FULL。
 */

const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 }

export class SignupError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'NOT_OPEN'
      | 'CLOSED'
      | 'FULL'
      | 'CANCELLED'
      | 'ALREADY'
      | 'PENDING_ORDER'
      | 'INVALID_INPUT'
      | 'UNAVAILABLE' = 'INVALID_INPUT',
  ) {
    super(message)
    this.name = 'SignupError'
  }
}

/** 前台可見的場次：未刪除、非草稿、所屬活動已發布 */
export function visibleSessionWhere(): Prisma.SessionWhereInput {
  return {
    deletedAt: null,
    status: { not: SessionStatus.DRAFT },
    OR: [{ activityId: null }, { activity: { status: 'PUBLISHED', deletedAt: null } }],
  }
}

const SESSION_INCLUDE = {
  activity: true,
  courts: { include: { court: { select: { id: true, name: true, sortOrder: true } } } },
} satisfies Prisma.SessionInclude

type SessionRow = Prisma.SessionGetPayload<{ include: typeof SESSION_INCLUDE }>

/** 有效佔用名額的報名（已確認，或暫留／待付款且未到期） */
function activeSeatsWhere(at: Date): Prisma.SessionRegistrationWhereInput {
  return {
    OR: [
      { status: RegistrationStatus.CONFIRMED },
      { status: RegistrationStatus.PENDING, holdExpiresAt: { gt: at } },
    ],
  }
}

export async function seatsUsed(
  sessionIds: string[],
  opts: { excludeRegistrationId?: string; db?: Prisma.TransactionClient } = {},
): Promise<Map<string, number>> {
  const db = opts.db ?? prisma
  if (sessionIds.length === 0) return new Map()
  const rows = await db.sessionRegistration.groupBy({
    by: ['sessionId'],
    where: {
      sessionId: { in: sessionIds },
      ...activeSeatsWhere(now()),
      ...(opts.excludeRegistrationId ? { id: { not: opts.excludeRegistrationId } } : {}),
    },
    _sum: { seats: true },
  })
  return new Map(rows.map((r) => [r.sessionId, r._sum.seats ?? 0]))
}

export function publicCapacity(s: { capacity: number; reservedCapacity: number }): number {
  return Math.max(0, s.capacity - s.reservedCapacity)
}

/** 依時間與名額計算報名狀態 */
export function signupState(
  s: {
    status: SessionStatus
    deletedAt: Date | null
    startAt: Date
    endAt: Date
    bookingOpenAt: Date
    bookingCloseAt: Date
  },
  remaining: number,
  at: Date = now(),
): SignupState {
  if (s.status === SessionStatus.CANCELLED || s.deletedAt) return 'CANCELLED'
  if (at >= s.endAt) return 'ENDED'
  if (at >= s.startAt) return 'IN_PROGRESS'
  if (s.status === SessionStatus.DRAFT || at < s.bookingOpenAt) return 'NOT_OPEN'
  if (at >= s.bookingCloseAt || s.status === SessionStatus.LOCKED) return 'CLOSED'
  if (remaining <= 0) return 'FULL'
  return 'OPEN'
}

function dateTimeLabel(d: Date): string {
  return `${shortDateLabel(taipeiDateString(d))} ${formatMinute(taipeiMinuteOfDay(d))}`
}

export function coverOf(assetId: string | null | undefined, focusX = 50, focusY = 50) {
  return {
    src: assetId ? `/media/${assetId}` : null,
    thumb: assetId ? `/media/${assetId}?size=thumb` : null,
    focusX,
    focusY,
  }
}

async function toDTOs(rows: SessionRow[], userId: string | null): Promise<ActivitySessionDTO[]> {
  if (rows.length === 0) return []
  const at = now()
  const ids = rows.map((r) => r.id)
  const [used, mine, watches] = await Promise.all([
    seatsUsed(ids),
    userId
      ? prisma.sessionRegistration.findMany({
          where: {
            sessionId: { in: ids },
            userId,
            OR: [
              { status: RegistrationStatus.CONFIRMED },
              { status: RegistrationStatus.PENDING, holdExpiresAt: { gt: at } },
            ],
          },
          select: { sessionId: true, status: true, quantity: true, seats: true, bookingId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.sessionWatch.findMany({
          where: { sessionId: { in: ids }, userId, cancelledAt: null, notifiedAt: null },
          select: { sessionId: true },
        })
      : Promise.resolve([]),
  ])
  const mineMap = new Map(mine.map((m) => [m.sessionId, m]))
  const watchSet = new Set(watches.map((w) => w.sessionId))

  return rows.map((s) => {
    const a = s.activity
    const type = (a?.type ?? 'OPEN_PLAY') as ActivityTypeKey
    const unit = (a?.priceUnit ?? 'PER_PERSON') as PriceUnitKey
    const spu = seatsPerUnit(unit)
    const cap = publicCapacity(s)
    const remaining = Math.max(0, cap - (used.get(s.id) ?? 0))
    const state = signupState(s, remaining, at)
    const date = taipeiDateString(s.startAt)
    const startMinute = taipeiMinuteOfDay(s.startAt)
    const endMinute = startMinute + Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000)
    const courts = [...s.courts].sort((x, y) => x.court.sortOrder - y.court.sortOrder)

    const my = mineMap.get(s.id)
    const myStatus = my
      ? my.status === RegistrationStatus.CONFIRMED
        ? ('CONFIRMED' as const)
        : my.bookingId
          ? ('PENDING_PAYMENT' as const)
          : ('IN_CART' as const)
      : null
    // 已在購物車的人可以改數量：自己暫留的名額視為可用
    const ownSeats = myStatus === 'IN_CART' ? (my?.seats ?? 0) : 0
    const maxPerOrder = a?.maxPerOrder ?? 1
    const maxQuantity = Math.max(0, Math.min(maxPerOrder, Math.floor((remaining + ownSeats) / spu)))

    let opensAtLabel: string | null = null
    if (state === 'NOT_OPEN') opensAtLabel = `${dateTimeLabel(s.bookingOpenAt)} 開放報名`

    return {
      id: s.id,
      activityId: s.activityId,
      title: s.title,
      type,
      typeLabel: ACTIVITY_TYPE_LABEL[type],
      levelLabel: a?.levelLabel ?? null,
      summary: a?.summary ?? null,
      description: s.description ?? a?.description ?? null,
      requirements: a?.requirements ?? null,
      includes: a?.includes ?? null,
      refundNote: a?.refundNote ?? null,
      cover: coverOf(s.coverAssetId ?? a?.coverAssetId, s.coverFocusX ?? a?.coverFocusX ?? 50, s.coverFocusY ?? a?.coverFocusY ?? 50),
      date,
      dateLabel: shortDateLabel(date),
      startMinute,
      endMinute,
      timeLabel: activityTimeLabel(startMinute, endMinute),
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      courtIds: courts.map((c) => c.court.id),
      courtNames: courts.map((c) => c.court.name),
      price: s.price,
      priceUnit: unit,
      unitLabel: PRICE_UNIT_LABEL[unit],
      seatsPerUnit: spu,
      capacity: cap,
      remaining,
      maxQuantity,
      state,
      stateLabel: state === 'FULL' ? '已額滿' : SIGNUP_STATE_LABEL[state],
      opensAtLabel,
      closesAtLabel: `${dateTimeLabel(s.bookingCloseAt)} 截止報名`,
      mine: my && myStatus ? { status: myStatus, quantity: my.quantity, bookingId: my.bookingId } : null,
      watching: watchSet.has(s.id),
    }
  })
}

/** 某一天（場館日期）的活動場次 */
export async function getSessionsForDate(venueId: string, date: string, userId: string | null) {
  const rows = await prisma.session.findMany({
    where: {
      ...visibleSessionWhere(),
      venueId,
      startAt: { gte: taipeiToUtc(date, 0), lt: taipeiToUtc(date, 1440) },
    },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' },
  })
  return toDTOs(rows, userId)
}

/** 近期（尚未結束、未取消）的場次 */
export async function getUpcomingSessions(
  venueId: string,
  userId: string | null,
  opts: { days?: number; limit?: number; excludeDate?: string } = {},
) {
  const today = taipeiDateString()
  const rows = await prisma.session.findMany({
    where: {
      ...visibleSessionWhere(),
      venueId,
      status: { notIn: [SessionStatus.DRAFT, SessionStatus.CANCELLED] },
      endAt: { gt: now() },
      startAt: { lt: taipeiToUtc(addDays(today, opts.days ?? 60), 0) },
      ...(opts.excludeDate
        ? {
            NOT: {
              startAt: { gte: taipeiToUtc(opts.excludeDate, 0), lt: taipeiToUtc(opts.excludeDate, 1440) },
            },
          }
        : {}),
    },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' },
    take: opts.limit ?? 60,
  })
  return toDTOs(rows, userId)
}

export async function getSessionDTO(sessionId: string, userId: string | null) {
  const row = await prisma.session.findFirst({
    where: { ...visibleSessionWhere(), id: sessionId },
    include: SESSION_INCLUDE,
  })
  if (!row) return null
  const [dto] = await toDTOs([row], userId)
  return dto
}

export { groupIntoCards } from '@/lib/activity-shared'

/* ─────────────────────────── 加入購物車（暫留名額） ─────────────────────────── */

/**
 * 暫留活動名額並放進購物車。
 * 先寫入 Session 這一列取得寫入鎖，再計算名額與寫入暫留，
 * 多人同時搶最後一個名額時只有一人會成功。
 */
export async function holdSeats(params: {
  userId: string
  cartToken: string
  sessionId: string
  quantity: number
}): Promise<{ registrationId: string; expiresAt: Date }> {
  const quantity = Math.floor(params.quantity)
  if (!Number.isFinite(quantity) || quantity < 1) throw new SignupError('請選擇報名人數')
  const restricted = await activeRestrictions(params.userId)
  if (restricted.some((r) => r.type === 'BLACKLIST' || r.type === 'NO_ACTIVITY')) {
    throw new SignupError('您的帳號目前無法報名活動，請聯絡場館', 'UNAUTHORIZED')
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.session.updateMany({ where: { id: params.sessionId }, data: { updatedAt: new Date() } })
    if (locked.count === 0) throw new SignupError('找不到這場活動', 'NOT_FOUND')

    const s = await tx.session.findFirst({
      where: { ...visibleSessionWhere(), id: params.sessionId },
      include: { activity: true, venue: { select: { holdMinutes: true } } },
    })
    if (!s) throw new SignupError('這場活動目前未開放', 'NOT_FOUND')

    const existing = await tx.sessionRegistration.findUnique({
      where: { sessionId_userId: { sessionId: s.id, userId: params.userId } },
    })
    const at = now()
    if (existing) {
      if (existing.status === RegistrationStatus.CONFIRMED || existing.status === RegistrationStatus.WAITLISTED) {
        throw new SignupError('你已經報名這場活動', 'ALREADY')
      }
      if (existing.status === RegistrationStatus.PENDING && existing.bookingId && existing.holdExpiresAt && existing.holdExpiresAt > at) {
        throw new SignupError('這場已有待付款的訂單，請先完成付款或等候逾時', 'PENDING_ORDER')
      }
    }

    const used = (await seatsUsed([s.id], { db: tx, excludeRegistrationId: existing?.id })).get(s.id) ?? 0
    const remaining = publicCapacity(s) - used
    const state = signupState(s, remaining, at)
    switch (state) {
      case 'CANCELLED':
        throw new SignupError('這場活動已取消', 'CANCELLED')
      case 'ENDED':
      case 'IN_PROGRESS':
        throw new SignupError('這場活動已開始或結束', 'CLOSED')
      case 'NOT_OPEN':
        throw new SignupError(`尚未開放報名，${dateTimeLabel(s.bookingOpenAt)} 開放`, 'NOT_OPEN')
      case 'CLOSED':
        throw new SignupError('報名已截止', 'CLOSED')
      case 'FULL':
        throw new SignupError('名額已滿', 'FULL')
    }

    const unit = (s.activity?.priceUnit ?? 'PER_PERSON') as PriceUnitKey
    const maxPerOrder = s.activity?.maxPerOrder ?? 1
    if (quantity > maxPerOrder) throw new SignupError(`每筆最多報名 ${maxPerOrder} ${PRICE_UNIT_LABEL[unit]}`)
    const seats = quantity * seatsPerUnit(unit)
    if (seats > remaining) throw new SignupError(`名額不足，目前剩 ${Math.max(0, remaining)} 位`, 'FULL')

    const expiresAt = new Date(at.getTime() + s.venue.holdMinutes * 60_000)
    const data = {
      status: RegistrationStatus.PENDING,
      quantity,
      seats,
      unitPrice: s.price,
      holdExpiresAt: expiresAt,
      cartToken: params.cartToken,
      bookingId: null,
      waitlistPosition: null,
      addedByOrganizer: false,
      registeredAt: at,
      cancelledAt: null,
      promotedAt: null,
    }
    const reg = existing
      ? await tx.sessionRegistration.update({ where: { id: existing.id }, data })
      : await tx.sessionRegistration.create({ data: { ...data, sessionId: s.id, userId: params.userId } })
    return { registrationId: reg.id, expiresAt }
  }, TX_OPTIONS)
}

/** 從購物車移除活動（釋放暫留名額） */
export async function releaseSeatHold(cartToken: string, registrationId: string): Promise<string | null> {
  const reg = await prisma.sessionRegistration.findFirst({
    where: { id: registrationId, cartToken, status: RegistrationStatus.PENDING, bookingId: null },
    select: { sessionId: true },
  })
  if (!reg) return null
  await prisma.sessionRegistration.updateMany({
    where: { id: registrationId, cartToken, status: RegistrationStatus.PENDING, bookingId: null },
    data: { status: RegistrationStatus.EXPIRED, holdExpiresAt: null, cartToken: null },
  })
  return reg.sessionId
}

/* ─────────────────────────── 有名額通知我 ─────────────────────────── */

/** 需要 LINE Messaging API 才能推播；未設定時前台明示「尚未開放」 */
export function seatAlertsEnabled(): boolean {
  return canPush()
}

export async function watchSession(userId: string, sessionId: string): Promise<void> {
  if (!seatAlertsEnabled()) throw new SignupError('名額通知尚未開放', 'UNAVAILABLE')
  const s = await prisma.session.findFirst({ where: { ...visibleSessionWhere(), id: sessionId }, select: { id: true } })
  if (!s) throw new SignupError('找不到這場活動', 'NOT_FOUND')
  // 同一會員同一場次只會有一筆（唯一索引），重複訂閱只是重新啟用
  await prisma.sessionWatch.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: { cancelledAt: null, notifiedAt: null },
    create: { sessionId, userId },
  })
}

export async function unwatchSession(userId: string, sessionId: string): Promise<void> {
  await prisma.sessionWatch.updateMany({ where: { sessionId, userId, cancelledAt: null }, data: { cancelledAt: now() } })
}

/**
 * 名額釋出後通知訂閱者（每筆訂閱只通知一次；通知不保留名額）。
 * 釋出來源：購物車暫留逾時、訂單逾時、取消報名、後台調整名額。
 */
export async function notifySeatWatchers(sessionIds: string[]): Promise<number> {
  if (!seatAlertsEnabled() || sessionIds.length === 0) return 0
  const unique = [...new Set(sessionIds)]
  const rows = await prisma.session.findMany({
    where: { ...visibleSessionWhere(), id: { in: unique } },
    include: SESSION_INCLUDE,
  })
  const dtos = await toDTOs(rows, null)
  let sent = 0
  for (const s of dtos) {
    if (s.state !== 'OPEN' || s.remaining <= 0) continue
    const watchers = await prisma.sessionWatch.findMany({
      where: { sessionId: s.id, cancelledAt: null, notifiedAt: null },
      include: { user: { select: { lineUserId: true } } },
      take: 200,
    })
    for (const w of watchers) {
      // 先標記再推播，重跑時不會重複通知
      const claimed = await prisma.sessionWatch.updateMany({
        where: { id: w.id, notifiedAt: null, cancelledAt: null },
        data: { notifiedAt: now() },
      })
      if (claimed.count === 0 || !w.user.lineUserId) continue
      const ok = await pushMessages(w.user.lineUserId, [
        {
          type: 'text',
          text: `「${s.title}」${s.dateLabel} ${s.timeLabel} 目前有 ${s.remaining} 個名額。名額不保留，先完成報名付款者優先。`,
        },
      ])
      if (ok) sent++
    }
  }
  return sent
}
