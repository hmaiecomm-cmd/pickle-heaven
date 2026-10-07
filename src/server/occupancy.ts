import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { formatMinute, now, taipeiToUtc } from '@/lib/time'

/**
 * 場地佔用：一般訂場、付款中的暫留、活動場次、維護封場，全部記在 Reservation，
 * 以 (courtId, startsAt) 唯一索引作為最後一道防線——同一場地同一時段只會有一筆。
 *
 * 時間重疊規則：佔用以場館的時段格（slotMinutes）為單位，依活動「完整起訖時間」展開——
 * 非整點的活動（例如 19:30–20:30）會占用所有與它重疊的格（19:00–21:00），任何重疊的租借都會被擋下。
 * 對齊格線的活動「前一場結束 = 下一場開始」不共用任何一格，可以銜接。
 * 場館目前沒有清場緩衝設定；日後新增時，於 rangeSlots 前後各多佔幾格即可。
 */

export type OccupancyKind = 'BOOKED' | 'PENDING_ORDER' | 'HELD' | 'BLOCKED' | 'EVENT' | 'EVENT_DRAFT'

export interface Conflict {
  date: string
  courtId: string
  courtName: string
  startMinute: number
  endMinute: number
  kind: OccupancyKind
  reason: string
  sessionId: string | null
}

export class OccupancyConflictError extends Error {
  code = 'SLOT_TAKEN' as const
  constructor(message = '場地時段剛被占用，請重新檢查衝突') {
    super(message)
  }
}

/**
 * libSQL driver adapter 不會把 SQLite 的 constraint 錯誤轉成 P2002，
 * 而是包在 PrismaClientUnknownRequestError 的訊息裡，因此兩種都要判斷。
 */
export function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('UNIQUE constraint failed')
}

interface VenueGrid {
  openMinute: number
  closeMinute: number
  slotMinutes: number
}

/** 活動時間是否落在營業時段格線內；不合法時回傳說明 */
export function validateRange(venue: VenueGrid, startMinute: number, endMinute: number): string | null {
  if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) return '請填寫開始與結束時間'
  if (endMinute <= startMinute) return '結束時間必須晚於開始時間'
  if (startMinute < venue.openMinute || endMinute > venue.closeMinute) {
    return `活動時間需在營業時間 ${formatMinute(venue.openMinute)}–${venue.closeMinute >= 1440 ? '24:00' : formatMinute(venue.closeMinute)} 內`
  }
  if (startMinute % 5 !== 0 || endMinute % 5 !== 0) return '活動時間請以 5 分鐘為單位'
  return null
}

/** 某日某時間區間涵蓋（重疊）的所有時段格：起點向前、終點向後對齊格線 */
export function rangeSlots(venue: VenueGrid, date: string, startMinute: number, endMinute: number) {
  const out: { startMinute: number; startsAt: Date; endsAt: Date }[] = []
  const first = venue.openMinute + Math.floor((startMinute - venue.openMinute) / venue.slotMinutes) * venue.slotMinutes
  const lastEnd = venue.openMinute + Math.ceil((endMinute - venue.openMinute) / venue.slotMinutes) * venue.slotMinutes
  for (let m = first; m < lastEnd; m += venue.slotMinutes) {
    out.push({ startMinute: m, startsAt: taipeiToUtc(date, m), endsAt: taipeiToUtc(date, m + venue.slotMinutes) })
  }
  return out
}

export interface RangeQuery {
  date: string
  startMinute: number
  endMinute: number
}

/**
 * 找出指定日期區間、場地上的既有佔用。
 * 逾時的購物車暫留與逾期的草稿保留視為已釋放。
 * 回傳以 date 為 key 的衝突清單（同一場地連續多格合併成一段）。
 */
export async function findConflicts(params: {
  venue: VenueGrid
  courts: { id: string; name: string }[]
  ranges: RangeQuery[]
  excludeSessionIds?: string[]
}): Promise<Map<string, Conflict[]>> {
  const { venue, courts, ranges } = params
  const result = new Map<string, Conflict[]>()
  if (courts.length === 0 || ranges.length === 0) return result

  const slotIndex = new Map<number, { date: string; startMinute: number }>()
  for (const r of ranges) {
    for (const s of rangeSlots(venue, r.date, r.startMinute, r.endMinute)) {
      slotIndex.set(s.startsAt.getTime(), { date: r.date, startMinute: s.startMinute })
    }
  }

  const exclude = new Set(params.excludeSessionIds ?? [])
  const current = now()
  const rows = await prisma.reservation.findMany({
    where: {
      courtId: { in: courts.map((c) => c.id) },
      startsAt: { in: [...slotIndex.keys()].map((t) => new Date(t)) },
    },
    select: {
      courtId: true,
      startsAt: true,
      status: true,
      holdExpiresAt: true,
      bookingId: true,
      sessionId: true,
      note: true,
      session: { select: { title: true } },
    },
    orderBy: { startsAt: 'asc' },
  })

  const courtName = new Map(courts.map((c) => [c.id, c.name]))
  for (const r of rows) {
    if (r.sessionId && exclude.has(r.sessionId)) continue
    if ((r.status === 'HELD' || r.status === 'EVENT') && r.holdExpiresAt && r.holdExpiresAt <= current) continue
    const at = slotIndex.get(r.startsAt.getTime())
    if (!at) continue

    let kind: OccupancyKind
    let reason: string
    switch (r.status) {
      case 'BOOKED':
        kind = 'BOOKED'
        reason = '已有場地預約訂單'
        break
      case 'HELD':
        kind = r.bookingId ? 'PENDING_ORDER' : 'HELD'
        reason = r.bookingId ? '已有待付款的場地訂單' : '客人購物車暫留中'
        break
      case 'BLOCKED':
        kind = 'BLOCKED'
        reason = `維護封場${r.note ? `（${r.note}）` : ''}`
        break
      default:
        kind = r.holdExpiresAt ? 'EVENT_DRAFT' : 'EVENT'
        reason = r.holdExpiresAt
          ? `活動草稿「${r.session?.title ?? ''}」保留中`
          : `已被活動「${r.session?.title ?? ''}」使用`
    }

    const list = result.get(at.date) ?? []
    const last = list[list.length - 1]
    // 同場地、同原因、時間相連的格子合併成一段
    if (last && last.courtId === r.courtId && last.kind === kind && last.sessionId === r.sessionId && last.endMinute === at.startMinute) {
      last.endMinute = at.startMinute + venue.slotMinutes
    } else {
      list.push({
        date: at.date,
        courtId: r.courtId,
        courtName: courtName.get(r.courtId) ?? '',
        startMinute: at.startMinute,
        endMinute: at.startMinute + venue.slotMinutes,
        kind,
        reason,
        sessionId: r.sessionId,
      })
    }
    result.set(at.date, list)
  }
  return result
}

/**
 * 在交易中寫入活動佔用。任何一格已被佔用時整筆失敗（唯一索引），
 * 交易回滾，不會覆蓋任何既有訂單。
 */
export async function occupyCourts(
  tx: Prisma.TransactionClient,
  params: {
    sessionId: string
    venue: VenueGrid
    courtIds: string[]
    date: string
    startMinute: number
    endMinute: number
    holdExpiresAt?: Date | null
  },
): Promise<void> {
  const slots = rangeSlots(params.venue, params.date, params.startMinute, params.endMinute)
  const data = params.courtIds.flatMap((courtId) =>
    slots.map((s) => ({
      courtId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: 'EVENT' as const,
      sessionId: params.sessionId,
      holdExpiresAt: params.holdExpiresAt ?? null,
    })),
  )
  if (data.length === 0) return
  try {
    await tx.reservation.createMany({ data })
  } catch (err) {
    if (isUniqueViolation(err)) throw new OccupancyConflictError()
    throw err
  }
}

/** 釋放場次的所有場地佔用（取消、改時段、改場地時使用） */
export async function releaseOccupancy(tx: Prisma.TransactionClient, sessionId: string): Promise<number> {
  const res = await tx.reservation.deleteMany({ where: { sessionId, status: 'EVENT' } })
  return res.count
}
