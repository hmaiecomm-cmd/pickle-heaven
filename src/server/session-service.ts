import 'server-only'
import { Prisma, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * 球敘（Open Play）核心邏輯：報名、取消、候補遞補。
 *
 * 防超賣（規格 §15）：
 *   SQLite / libSQL 同一時間只允許一個寫入者，但預設的 BEGIN 是 DEFERRED——
 *   先讀後寫時，寫入鎖要到第一次寫入才取得，兩個交易可能讀到相同的人數。
 *   因此每個交易都先對 Session 這一列做一次寫入以取得寫入鎖，
 *   之後的「計數 → 寫入」才是真正不可分割的操作。
 */

export type JoinRejection =
  | 'SESSION_NOT_FOUND'
  | 'NOT_OPEN_YET'
  | 'BOOKING_CLOSED'
  | 'SESSION_LOCKED'
  | 'SESSION_CANCELLED'
  | 'ALREADY_REGISTERED'
  | 'FULL_NO_WAITLIST'

export type JoinResult =
  | { ok: true; status: 'CONFIRMED' }
  | { ok: true; status: 'WAITLISTED'; position: number }
  | { ok: false; reason: JoinRejection }

export type CancelResult =
  | { ok: true; status: 'CANCELLED' | 'LATE_CANCEL'; promotedUserId: string | null }
  | { ok: false; reason: 'NOT_REGISTERED' | 'SESSION_NOT_FOUND' | 'ALREADY_CANCELLED' }

/**
 * 交易設定。
 *
 * 報名一開放時會有一群人同時搶，而 lockSession 會讓這些交易排隊等寫入鎖。
 * Turso 是網路資料庫，交易內每個操作都是一次往返，排隊時很容易超過 Prisma
 * 預設的 5 秒上限而丟出 P2028。因此放寬上限，並盡量減少交易內的操作數。
 */
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 }

/** 先寫入 Session 這一列以取得寫入鎖，讓後續讀取不會與其他交易交錯。 */
async function lockSession(tx: Prisma.TransactionClient, sessionId: string) {
  const updated = await tx.session.updateMany({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  })
  if (updated.count === 0) return null
  return tx.session.findUnique({ where: { id: sessionId } })
}

/** 一般玩家可報名的名額 = 總容量 − 保留名額。 */
function publicCapacity(capacity: number, reservedCapacity: number): number {
  return Math.max(0, capacity - reservedCapacity)
}

/** 依正取人數在 OPEN / FULL 之間切換；其他狀態不動。 */
async function syncFullState(
  tx: Prisma.TransactionClient,
  sessionId: string,
  capacity: number,
  reservedCapacity: number,
  current: SessionStatus,
) {
  if (current !== SessionStatus.OPEN && current !== SessionStatus.FULL) return

  const confirmed = await tx.sessionRegistration.count({
    where: { sessionId, status: RegistrationStatus.CONFIRMED },
  })
  const next =
    confirmed >= publicCapacity(capacity, reservedCapacity) ? SessionStatus.FULL : SessionStatus.OPEN

  if (next !== current) {
    await tx.session.update({ where: { id: sessionId }, data: { status: next } })
  }
}

/** 把候補第一位（FIFO）升為正取，回傳被遞補者的 userId。 */
async function promoteNext(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
): Promise<string | null> {
  const next = await tx.sessionRegistration.findFirst({
    where: { sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: [{ waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
  })
  if (!next) return null

  await tx.sessionRegistration.update({
    where: { id: next.id },
    data: { status: RegistrationStatus.CONFIRMED, waitlistPosition: null, promotedAt: now },
  })
  return next.userId
}

/** 重新編排候補順位為連續的 1、2、3…，並保持原本的 FIFO 順序。 */
async function resequenceWaitlist(tx: Prisma.TransactionClient, sessionId: string) {
  const waiting = await tx.sessionRegistration.findMany({
    where: { sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: [{ waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
    select: { id: true, waitlistPosition: true },
  })

  for (let i = 0; i < waiting.length; i++) {
    const position = i + 1
    if (waiting[i].waitlistPosition !== position) {
      await tx.sessionRegistration.update({
        where: { id: waiting[i].id },
        data: { waitlistPosition: position },
      })
    }
  }
}

/**
 * 報名一場球敘。名額足夠即為正取，否則進候補（若有開放）。
 *
 * @param byOrganizer 主辦者手動加入時為 true，可動用保留名額並略過時間檢查
 */
export async function joinSession(
  sessionId: string,
  userId: string,
  byOrganizer = false,
): Promise<JoinResult> {
  const now = new Date()

  const result = await prisma.$transaction(async (tx): Promise<JoinResult> => {
    const session = await lockSession(tx, sessionId)
    if (!session) return { ok: false, reason: 'SESSION_NOT_FOUND' }

    if (!byOrganizer) {
      if (session.status === SessionStatus.CANCELLED) {
        return { ok: false, reason: 'SESSION_CANCELLED' }
      }
      if (
        session.status === SessionStatus.LOCKED ||
        session.status === SessionStatus.PLAYING ||
        session.status === SessionStatus.COMPLETED
      ) {
        return { ok: false, reason: 'SESSION_LOCKED' }
      }
      if (session.status === SessionStatus.DRAFT || now < session.bookingOpenAt) {
        return { ok: false, reason: 'NOT_OPEN_YET' }
      }
      if (now >= session.bookingCloseAt) {
        return { ok: false, reason: 'BOOKING_CLOSED' }
      }
    }

    const existing = await tx.sessionRegistration.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    })
    // 曾經取消過的人可以重新報名，沿用同一筆紀錄
    if (
      existing &&
      existing.status !== RegistrationStatus.CANCELLED &&
      existing.status !== RegistrationStatus.LATE_CANCEL
    ) {
      return { ok: false, reason: 'ALREADY_REGISTERED' }
    }

    const confirmedCount = await tx.sessionRegistration.count({
      where: { sessionId, status: RegistrationStatus.CONFIRMED },
    })

    const limit = byOrganizer
      ? session.capacity
      : publicCapacity(session.capacity, session.reservedCapacity)

    let status: RegistrationStatus
    let waitlistPosition: number | null = null

    if (confirmedCount < limit) {
      status = RegistrationStatus.CONFIRMED
    } else if (session.waitlistEnabled) {
      status = RegistrationStatus.WAITLISTED
      const last = await tx.sessionRegistration.findFirst({
        where: { sessionId, status: RegistrationStatus.WAITLISTED },
        orderBy: { waitlistPosition: 'desc' },
        select: { waitlistPosition: true },
      })
      waitlistPosition = (last?.waitlistPosition ?? 0) + 1
    } else {
      return { ok: false, reason: 'FULL_NO_WAITLIST' }
    }

    const data = {
      status,
      waitlistPosition,
      addedByOrganizer: byOrganizer,
      registeredAt: now,
      cancelledAt: null,
      promotedAt: null,
    }

    if (existing) {
      await tx.sessionRegistration.update({ where: { id: existing.id }, data })
    } else {
      await tx.sessionRegistration.create({ data: { sessionId, userId, ...data } })
    }

    if (status === RegistrationStatus.CONFIRMED) {
      await syncFullState(tx, sessionId, session.capacity, session.reservedCapacity, session.status)
      return { ok: true, status: 'CONFIRMED' }
    }

    return { ok: true, status: 'WAITLISTED', position: waitlistPosition ?? 1 }
  }, TX_OPTIONS)

  // 信賴度統計只是參考指標，放在交易外可少一次往返、縮短其他人的等待
  if (result.ok && result.status === 'CONFIRMED') {
    await prisma.user
      .update({ where: { id: userId }, data: { sessionsJoined: { increment: 1 } } })
      .catch(() => {})
  }

  return result
}

/**
 * 取消報名。
 *
 * 截止前 → CANCELLED，並自動遞補候補第一位。
 * 截止後 → LATE_CANCEL，僅在 allowPostLockReplacement 為 true 時才遞補。
 */
export async function cancelRegistration(
  sessionId: string,
  userId: string,
): Promise<CancelResult> {
  const now = new Date()

  const result = await prisma.$transaction(async (tx): Promise<CancelResult> => {
    const session = await lockSession(tx, sessionId)
    if (!session) return { ok: false, reason: 'SESSION_NOT_FOUND' }

    const reg = await tx.sessionRegistration.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    })
    if (!reg) return { ok: false, reason: 'NOT_REGISTERED' }
    if (
      reg.status === RegistrationStatus.CANCELLED ||
      reg.status === RegistrationStatus.LATE_CANCEL
    ) {
      return { ok: false, reason: 'ALREADY_CANCELLED' }
    }

    const late = now >= session.cancelDeadline
    const wasConfirmed = reg.status === RegistrationStatus.CONFIRMED
    const status = late ? RegistrationStatus.LATE_CANCEL : RegistrationStatus.CANCELLED

    await tx.sessionRegistration.update({
      where: { id: reg.id },
      data: { status, waitlistPosition: null, cancelledAt: now },
    })

    // 候補本來就不佔正取名額，取消後只需重排順位
    if (!wasConfirmed) {
      await resequenceWaitlist(tx, sessionId)
      return { ok: true, status: late ? 'LATE_CANCEL' : 'CANCELLED', promotedUserId: null }
    }

    let promotedUserId: string | null = null
    const mayPromote = session.autoPromote && (!late || session.allowPostLockReplacement)
    if (mayPromote) {
      promotedUserId = await promoteNext(tx, sessionId, now)
    }

    await resequenceWaitlist(tx, sessionId)
    await syncFullState(tx, sessionId, session.capacity, session.reservedCapacity, session.status)

    return { ok: true, status: late ? 'LATE_CANCEL' : 'CANCELLED', promotedUserId }
  }, TX_OPTIONS)

  if (result.ok) {
    const late = result.status === 'LATE_CANCEL'
    await prisma.user
      .update({
        where: { id: userId },
        data: late ? { lateCancelCount: { increment: 1 } } : { normalCancelCount: { increment: 1 } },
      })
      .catch(() => {})
  }

  return result
}
