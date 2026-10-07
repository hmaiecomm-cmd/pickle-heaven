import 'server-only'
import { Prisma, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parseWeekdays, upcomingOccurrences } from '@/lib/session-schedule'
import { zonedParts } from '@/lib/timezone'

/**
 * 球敘排程任務（規格 §11、§12）。
 *
 * 所有狀態推進都是「掃描時間戳 → 批次更新」，不為任何一場球敘建立計時器，
 * 因此場館數從 1 增加到 1000 都不需改變架構。
 *
 * 冪等性（§12）：每個任務重複執行都不得造成重複結果。
 *   - 狀態轉換：WHERE 條件已限定來源狀態，重跑時不會再次命中
 *   - 場次產生：靠 @@unique([templateId, startAt])
 *   - 名單快照：寫入前先檢查該場次是否已有 FINAL_ROSTER
 *   - 通知：靠 NotificationLog.dedupeKey 的唯一索引
 */

export type JobResult = Record<string, number>

/** 單場一次最多處理的筆數，避免單次排程執行過久。 */
const BATCH_LIMIT = 500

/**
 * 判斷是否為唯一鍵衝突。
 *
 * 注意：libSQL driver adapter 不會把 SQLite 的 constraint 錯誤轉成 Prisma 的
 * P2002，而是丟出 PrismaClientUnknownRequestError 並把原始訊息包在裡面，
 * 因此不能只比對 err.code，必須一併檢查訊息內容。
 */
function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('UNIQUE constraint failed')
}

/**
 * 寫入一筆待送通知。dedupeKey 重複時視為已排入，不重複建立。
 * 回傳是否為本次新增。
 */
async function queueNotification(params: {
  dedupeKey: string
  type: Prisma.NotificationLogCreateInput['type']
  userId?: string | null
  sessionId?: string | null
  registrationId?: string | null
  payload?: Prisma.InputJsonValue
}): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: {
        dedupeKey: params.dedupeKey,
        type: params.type,
        userId: params.userId ?? null,
        sessionId: params.sessionId ?? null,
        registrationId: params.registrationId ?? null,
        payload: params.payload,
      },
    })
    return true
  } catch (err) {
    // 唯一鍵衝突代表先前已排入，屬於正常的重跑情形
    if (isUniqueViolation(err)) return false
    throw err
  }
}

/** SCHEDULED → OPEN：報名開放時間已到。 */
export async function openBookings(now = new Date()): Promise<JobResult> {
  const { count } = await prisma.session.updateMany({
    where: { status: SessionStatus.SCHEDULED, bookingOpenAt: { lte: now } },
    data: { status: SessionStatus.OPEN },
  })
  return { opened: count }
}

/**
 * OPEN / FULL → LOCKED：已達 finalizeAt。
 * 同時產生最終名單快照並把通知排入佇列。
 */
export async function lockSessions(now = new Date()): Promise<JobResult> {
  const due = await prisma.session.findMany({
    where: {
      status: { in: [SessionStatus.OPEN, SessionStatus.FULL] },
      finalizeAt: { lte: now },
    },
    take: BATCH_LIMIT,
    select: { id: true },
  })

  let locked = 0
  let snapshots = 0
  let queued = 0

  for (const { id } of due) {
    // 以 WHERE 限定來源狀態，確保兩個排程同時跑也只有一個會成功
    const res = await prisma.session.updateMany({
      where: { id, status: { in: [SessionStatus.OPEN, SessionStatus.FULL] } },
      data: { status: SessionStatus.LOCKED, lockedAt: now },
    })
    if (res.count === 0) continue
    locked++

    const created = await createFinalRoster(id, now)
    snapshots += created.snapshots
    queued += created.queued
  }

  return { locked, snapshots, queuedNotifications: queued }
}

/** 產生最終名單快照並排入通知；已存在則不重複建立（§9、§12）。 */
export async function createFinalRoster(sessionId: string, now = new Date()) {
  const existing = await prisma.sessionRosterSnapshot.findFirst({
    where: { sessionId, snapshotType: 'FINAL_ROSTER' },
    select: { id: true },
  })
  if (existing) return { snapshots: 0, queued: 0 }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      registrations: {
        where: { status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
        orderBy: [{ status: 'asc' }, { waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  })
  if (!session) return { snapshots: 0, queued: 0 }

  const confirmed = session.registrations
    .filter((r) => r.status === RegistrationStatus.CONFIRMED)
    .map((r, i) => ({ position: i + 1, userId: r.user.id, name: r.user.displayName }))
  const waitlist = session.registrations
    .filter((r) => r.status === RegistrationStatus.WAITLISTED)
    .map((r, i) => ({ position: i + 1, userId: r.user.id, name: r.user.displayName }))

  const roster = {
    sessionId,
    title: session.title,
    venueName: session.venue.name,
    courtName: session.court?.name ?? null,
    timezone: session.venue.timezone,
    startAt: session.startAt.toISOString(),
    endAt: session.endAt.toISOString(),
    lockedAt: now.toISOString(),
    confirmed,
    waitlist,
  }

  await prisma.sessionRosterSnapshot.create({
    data: { sessionId, snapshotType: 'FINAL_ROSTER', rosterJson: roster },
  })

  // 每位參與者各排一則通知，dedupeKey 確保重跑不會重複發送
  let queued = 0
  for (const person of [...confirmed, ...waitlist]) {
    const added = await queueNotification({
      dedupeKey: `FINAL_ROSTER:${sessionId}:${person.userId}`,
      type: 'FINAL_ROSTER',
      userId: person.userId,
      sessionId,
      payload: roster,
    })
    if (added) queued++
  }

  return { snapshots: 1, queued }
}

/** LOCKED → PLAYING：已到開打時間。 */
export async function startPlayingSessions(now = new Date()): Promise<JobResult> {
  const { count } = await prisma.session.updateMany({
    where: {
      status: { in: [SessionStatus.LOCKED, SessionStatus.OPEN, SessionStatus.FULL] },
      startAt: { lte: now },
      endAt: { gt: now },
    },
    data: { status: SessionStatus.PLAYING },
  })
  return { playing: count }
}

/** PLAYING → COMPLETED：已結束，並結算出席狀態與個人統計。 */
export async function completeSessions(now = new Date()): Promise<JobResult> {
  const due = await prisma.session.findMany({
    where: {
      status: { in: [SessionStatus.PLAYING, SessionStatus.LOCKED] },
      endAt: { lte: now },
    },
    take: BATCH_LIMIT,
    select: { id: true },
  })

  let completed = 0
  let marked = 0

  for (const { id } of due) {
    const res = await prisma.session.updateMany({
      where: { id, status: { in: [SessionStatus.PLAYING, SessionStatus.LOCKED] } },
      data: { status: SessionStatus.COMPLETED },
    })
    if (res.count === 0) continue
    completed++

    const attendees = await prisma.sessionRegistration.findMany({
      where: { sessionId: id, status: RegistrationStatus.CONFIRMED },
      select: { id: true, userId: true },
    })

    for (const a of attendees) {
      await prisma.sessionRegistration.update({
        where: { id: a.id },
        data: { status: RegistrationStatus.COMPLETED },
      })
      await prisma.user.update({
        where: { id: a.userId },
        data: { sessionsCompleted: { increment: 1 } },
      })
      marked++
    }
  }

  return { completed, attendeesMarked: marked }
}

/**
 * 依範本補足未來場次（§10）。
 *
 * 只產生範本設定的 generateWeeksAhead 週，不會無限產生；
 * 重複執行時靠 @@unique([templateId, startAt]) 跳過已存在的場次。
 */
export async function generateUpcomingSessions(now = new Date()): Promise<JobResult> {
  // 週期範本已停用：活動場次改由後台「活動」預覽衝突後建立（有結束條件、不會無限延伸、會佔用場地）。
  // 保留函式讓舊排程呼叫不出錯。
  if (process.env.LEGACY_TEMPLATE_GENERATION !== '1') return { generated: 0 }

  const templates = await prisma.sessionTemplate.findMany({
    where: { active: true },
    include: { venue: { select: { timezone: true } } },
  })

  let created = 0
  let skipped = 0

  for (const t of templates) {
    const rule = {
      timezone: t.venue.timezone,
      startMinute: t.startMinute,
      endMinute: t.endMinute,
      bookingOpenDaysBefore: t.bookingOpenDaysBefore,
      bookingOpenHourOffset: t.bookingOpenHourOffset,
      cancellationMode: t.cancellationMode,
      cancellationHoursBefore: t.cancellationHoursBefore,
    }

    // 每週多天（含每天）時，逐一展開每個星期再合併
    const occurrences = parseWeekdays(t.weekdays, t.weekday)
      .flatMap((wd) => upcomingOccurrences(now, wd, t.generateWeeksAhead, rule))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    // 後台刪除的場次保留為軟刪除列，這裡照樣算「已存在」，才不會被補回來
    const existing = await prisma.session.findMany({
      where: { templateId: t.id, startAt: { in: occurrences.map((o) => o.startAt) } },
      select: { startAt: true },
    })
    const taken = new Set(existing.map((e) => e.startAt.getTime()))

    for (const times of occurrences) {
      // 正常情況靠這個判斷跳過；唯一鍵是兩個排程同時執行時的最後防線
      if (taken.has(times.startAt.getTime())) {
        skipped++
        continue
      }
      try {
        await prisma.session.create({
          data: {
            organizationId: t.organizationId,
            templateId: t.id,
            venueId: t.venueId,
            courtId: t.courtId,
            title: t.title,
            startAt: times.startAt,
            endAt: times.endAt,
            bookingOpenAt: times.bookingOpenAt,
            bookingCloseAt: times.cancelDeadline,
            cancelDeadline: times.cancelDeadline,
            finalizeAt: times.finalizeAt,
            capacity: t.capacity,
            reservedCapacity: t.reservedCapacity,
            skillLevelMin: t.skillLevelMin,
            skillLevelMax: t.skillLevelMax,
            price: t.price,
            waitlistEnabled: t.waitlistEnabled,
            autoPromote: t.autoPromote,
            allowPostLockReplacement: t.allowPostLockReplacement,
            // 開放時間已到就直接開放，否則等排程推進
            status: times.bookingOpenAt <= now ? SessionStatus.OPEN : SessionStatus.SCHEDULED,
          },
        })
        created++
      } catch (err) {
        if (isUniqueViolation(err)) {
          skipped++
          continue
        }
        throw err
      }
    }
  }

  return { sessionsCreated: created, alreadyExisted: skipped }
}

/** 開打前排入提醒通知（預設 24 小時內、尚未提醒過的場次）。 */
export async function queueReminders(now = new Date(), hoursAhead = 24): Promise<JobResult> {
  const until = new Date(now.getTime() + hoursAhead * 3_600_000)

  const sessions = await prisma.session.findMany({
    where: {
      status: { in: [SessionStatus.LOCKED, SessionStatus.OPEN, SessionStatus.FULL] },
      startAt: { gt: now, lte: until },
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      title: true,
      startAt: true,
      registrations: {
        where: { status: RegistrationStatus.CONFIRMED },
        select: { id: true, userId: true },
      },
    },
  })

  let queued = 0
  for (const s of sessions) {
    for (const r of s.registrations) {
      const added = await queueNotification({
        dedupeKey: `REMINDER:${s.id}:${r.userId}`,
        type: 'REMINDER',
        userId: r.userId,
        sessionId: s.id,
        registrationId: r.id,
        payload: { title: s.title, startAt: s.startAt.toISOString() },
      })
      if (added) queued++
    }
  }

  return { remindersQueued: queued }
}

/**
 * 依序執行全部排程任務。
 * 順序有意義：先補場次、再開放、再鎖定，讓新產生的場次也能在同一輪被處理。
 */
export async function runAllSessionJobs(now = new Date()) {
  return {
    ranAt: now.toISOString(),
    ...(await generateUpcomingSessions(now)),
    ...(await openBookings(now)),
    ...(await lockSessions(now)),
    ...(await startPlayingSessions(now)),
    ...(await completeSessions(now)),
    ...(await queueReminders(now)),
  }
}
