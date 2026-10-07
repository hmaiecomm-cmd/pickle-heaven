'use server'

import { revalidatePath } from 'next/cache'
import { CancellationMode, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { computeSessionTimes } from '@/lib/session-schedule'
import type { TemplateInput } from './template-admin-actions'
import { joinSession } from './session-service'
import { createFinalRoster } from './session-scheduler'

/**
 * 主辦者對球敘的管理操作（規格 §14）。
 *
 * 每個動作都先經過 requireAdmin()，未登入會被導向後台登入頁。
 * 名單相關的異動一律走 session-service / session-scheduler 既有的邏輯，
 * 避免後台繞過正取人數與候補順位的規則。
 */

export type AdminResult = { ok: boolean; message: string }

const ok = (message: string): AdminResult => ({ ok: true, message })
const fail = (message: string): AdminResult => ({ ok: false, message })

function refresh(sessionId: string) {
  revalidatePath(`/admin/sessions/${sessionId}`)
  revalidatePath('/admin/sessions')
  revalidatePath('/sessions')
}

/** 依顯示名稱手動加入球友；找不到就建一個沒有 LINE 綁定的帳號。 */
export async function adminAddPlayer(sessionId: string, displayName: string): Promise<AdminResult> {
  await requireAdmin()
  const name = displayName.trim()
  if (!name) return fail('請輸入球友名稱')

  const existing = await prisma.user.findFirst({
    where: { displayName: name },
    orderBy: { createdAt: 'asc' },
  })
  const user =
    existing ?? (await prisma.user.create({ data: { displayName: name, lineUserId: null } }))

  // byOrganizer：可動用保留名額，且不受報名開放時間限制
  const result = await joinSession(sessionId, user.id, true)
  refresh(sessionId)

  if (!result.ok) {
    const messages: Record<string, string> = {
      ALREADY_REGISTERED: `${name} 已經在名單上了`,
      SESSION_NOT_FOUND: '找不到這場球敘',
      FULL_NO_WAITLIST: '已額滿且未開放候補',
    }
    return fail(messages[result.reason] ?? '加入失敗')
  }

  return ok(
    result.status === 'CONFIRMED'
      ? `已把 ${name} 加入正取`
      : `已把 ${name} 加入候補 #${result.position}`,
  )
}

/** 把某位候補立刻升為正取（可超出名額，由主辦者自行負責）。 */
export async function adminPromote(registrationId: string): Promise<AdminResult> {
  await requireAdmin()

  const reg = await prisma.sessionRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { displayName: true } } },
  })
  if (!reg) return fail('找不到這筆報名')
  if (reg.status !== RegistrationStatus.WAITLISTED) return fail('這位球友不在候補名單')

  await prisma.sessionRegistration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.CONFIRMED,
      waitlistPosition: null,
      promotedAt: new Date(),
    },
  })
  await resequence(reg.sessionId)
  refresh(reg.sessionId)
  return ok(`已把 ${reg.user.displayName} 升為正取`)
}

/** 把某位正取改為候補（例如主辦者要調整名單）。 */
export async function adminDemote(registrationId: string): Promise<AdminResult> {
  await requireAdmin()

  const reg = await prisma.sessionRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { displayName: true } } },
  })
  if (!reg) return fail('找不到這筆報名')
  if (reg.status !== RegistrationStatus.CONFIRMED) return fail('這位球友不在正取名單')

  const last = await prisma.sessionRegistration.findFirst({
    where: { sessionId: reg.sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: { waitlistPosition: 'desc' },
    select: { waitlistPosition: true },
  })

  await prisma.sessionRegistration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.WAITLISTED,
      waitlistPosition: (last?.waitlistPosition ?? 0) + 1,
      promotedAt: null,
    },
  })
  await resequence(reg.sessionId)
  refresh(reg.sessionId)
  return ok(`已把 ${reg.user.displayName} 移到候補`)
}

/** 直接把某位球友移出名單。 */
export async function adminRemove(registrationId: string): Promise<AdminResult> {
  await requireAdmin()

  const reg = await prisma.sessionRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { displayName: true } } },
  })
  if (!reg) return fail('找不到這筆報名')

  await prisma.sessionRegistration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.CANCELLED,
      waitlistPosition: null,
      cancelledAt: new Date(),
    },
  })
  await resequence(reg.sessionId)
  refresh(reg.sessionId)
  return ok(`已把 ${reg.user.displayName} 移出名單`)
}

/** 標記出席或未到（規格 §14、§17 的信賴度統計來源）。 */
export async function adminMarkAttendance(
  registrationId: string,
  attended: boolean,
): Promise<AdminResult> {
  await requireAdmin()

  const reg = await prisma.sessionRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { displayName: true } } },
  })
  if (!reg) return fail('找不到這筆報名')

  const alreadyCounted =
    reg.status === RegistrationStatus.COMPLETED || reg.status === RegistrationStatus.NO_SHOW

  await prisma.sessionRegistration.update({
    where: { id: registrationId },
    data: {
      status: attended ? RegistrationStatus.COMPLETED : RegistrationStatus.NO_SHOW,
      checkedInAt: attended ? new Date() : null,
    },
  })

  // 重複點選同一顆按鈕不應把統計愈加愈多
  if (!alreadyCounted) {
    await prisma.user.update({
      where: { id: reg.userId },
      data: attended
        ? { sessionsCompleted: { increment: 1 } }
        : { noShowCount: { increment: 1 } },
    })
  }

  refresh(reg.sessionId)
  return ok(`${reg.user.displayName} 已標記為${attended ? '出席' : '未到'}`)
}

/** 手動鎖定：立刻產生最終名單，之後不再接受一般報名。 */
export async function adminLockSession(sessionId: string): Promise<AdminResult> {
  await requireAdmin()

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) return fail('找不到這場球敘')
  if (session.status === SessionStatus.LOCKED) return fail('這場已經鎖定了')
  if (
    session.status !== SessionStatus.OPEN &&
    session.status !== SessionStatus.FULL &&
    session.status !== SessionStatus.SCHEDULED
  ) {
    return fail('這場的狀態無法鎖定')
  }

  const now = new Date()
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: SessionStatus.LOCKED, lockedAt: now },
  })
  const created = await createFinalRoster(sessionId, now)

  refresh(sessionId)
  return ok(
    created.snapshots > 0 ? '已鎖定並產生最終名單' : '已鎖定（先前已有最終名單，未重複產生）',
  )
}

/** 整場取消。 */
export async function adminCancelSession(
  sessionId: string,
  reason: string,
): Promise<AdminResult> {
  await requireAdmin()

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) return fail('找不到這場球敘')
  if (session.status === SessionStatus.CANCELLED) return fail('這場已經取消了')

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: SessionStatus.CANCELLED, cancelReason: reason.trim() || null },
  })

  refresh(sessionId)
  return ok('已取消這場球敘')
}

/** 調整場次設定（容量、價格、候補規則等）。 */
export async function adminUpdateSession(
  sessionId: string,
  input: {
    title: string
    capacity: number
    reservedCapacity: number
    price: number
    waitlistEnabled: boolean
    autoPromote: boolean
    allowPostLockReplacement: boolean
  },
): Promise<AdminResult> {
  await requireAdmin()

  if (input.capacity < 1) return fail('容量至少要 1 人')
  if (input.reservedCapacity < 0 || input.reservedCapacity >= input.capacity) {
    return fail('保留名額必須小於總容量')
  }
  if (input.price < 0) return fail('價格不能是負數')

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      title: input.title.trim() || '球敘',
      capacity: input.capacity,
      reservedCapacity: input.reservedCapacity,
      price: input.price,
      waitlistEnabled: input.waitlistEnabled,
      autoPromote: input.autoPromote,
      allowPostLockReplacement: input.allowPostLockReplacement,
    },
  })

  refresh(sessionId)
  return ok('設定已更新')
}

/** 不重複的單場球敘：沿用範本的欄位，但以指定日期取代重複星期。 */
export type OneOffInput = Omit<TemplateInput, 'weekdays' | 'generateWeeksAhead' | 'active'> & {
  /// 場館時區的日期 YYYY-MM-DD
  date: string
}

/** 新增一場不重複的球敘。時間戳的算法與範本產生的場次完全相同。成功時回傳新場次 id。 */
export async function adminCreateSession(input: OneOffInput): Promise<AdminResult & { sessionId?: string }> {
  const admin = await requireAdmin()

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date)
  if (!match) return fail('請選擇日期')
  if (!input.title.trim()) return fail('請輸入名稱')
  if (input.endMinute <= input.startMinute) return fail('結束時間必須晚於開始時間')
  if (input.capacity < 1) return fail('容量至少要 1 人')
  if (input.reservedCapacity < 0 || input.reservedCapacity >= input.capacity) {
    return fail('保留名額必須小於總容量')
  }
  if (input.price < 0) return fail('價格不能是負數')
  if (input.bookingOpenDaysBefore < 0) return fail('報名開放天數不能是負數')
  if (input.cancellationMode === CancellationMode.CUSTOM_TIMESTAMP) {
    return fail('單場球敘請選「前一日 00:00」或「開打前 N 小時」')
  }
  if (
    input.cancellationMode === CancellationMode.HOURS_BEFORE_START &&
    (input.cancellationHoursBefore == null || input.cancellationHoursBefore < 0)
  ) {
    return fail('請填寫開打前幾小時截止')
  }
  if (input.skillLevelMin != null && input.skillLevelMax != null && input.skillLevelMin > input.skillLevelMax) {
    return fail('程度下限不能高於上限')
  }

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
  if (!venue) return fail('尚未建立任何場館')

  const [, y, m, d] = match.map(Number)
  const times = computeSessionTimes(
    { year: y, month: m, day: d, hour: 0, minute: 0, second: 0, weekday: 0 },
    {
      timezone: venue.timezone,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      bookingOpenDaysBefore: input.bookingOpenDaysBefore,
      bookingOpenHourOffset: input.bookingOpenHourOffset,
      cancellationMode: input.cancellationMode,
      cancellationHoursBefore: input.cancellationHoursBefore,
    },
  )

  const now = new Date()
  if (times.startAt <= now) return fail('開打時間已經過了')

  const session = await prisma.session.create({
    data: {
      organizationId: venue.organizationId,
      venueId: venue.id,
      title: input.title.trim(),
      startAt: times.startAt,
      endAt: times.endAt,
      bookingOpenAt: times.bookingOpenAt,
      bookingCloseAt: times.cancelDeadline,
      cancelDeadline: times.cancelDeadline,
      finalizeAt: times.finalizeAt,
      capacity: input.capacity,
      reservedCapacity: input.reservedCapacity,
      skillLevelMin: input.skillLevelMin,
      skillLevelMax: input.skillLevelMax,
      price: input.price,
      waitlistEnabled: input.waitlistEnabled,
      autoPromote: input.autoPromote,
      allowPostLockReplacement: input.allowPostLockReplacement,
      status: times.bookingOpenAt <= now ? SessionStatus.OPEN : SessionStatus.SCHEDULED,
    },
  })

  await prisma.auditLog.create({
    data: {
      actor: admin,
      action: 'SESSION_CREATE',
      target: session.id,
      detail: { title: session.title, date: input.date, capacity: session.capacity, price: session.price },
    },
  })

  refresh(session.id)
  return { ...ok('已新增球敘'), sessionId: session.id }
}

/**
 * 刪除一場球敘。
 *
 * 單場球敘直接刪除（報名紀錄一併刪除）。範本產生的場次改為軟刪除：
 * 若真的刪掉，下一輪排程會因為「這天還沒有場次」又把它產生回來。
 */
export async function adminDeleteSession(sessionId: string): Promise<AdminResult> {
  await requireAdmin()

  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session || session.deletedAt) return fail('找不到這場球敘')

  if (session.templateId) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        deletedAt: new Date(),
        status: SessionStatus.CANCELLED,
        cancelReason: session.cancelReason ?? '主辦已刪除此場次',
      },
    })
  } else {
    await prisma.session.delete({ where: { id: sessionId } })
  }

  refresh(sessionId)
  return ok('已刪除這場球敘')
}

/** 重新編排候補順位為連續的 1、2、3…。 */
async function resequence(sessionId: string) {
  const waiting = await prisma.sessionRegistration.findMany({
    where: { sessionId, status: RegistrationStatus.WAITLISTED },
    orderBy: [{ waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
    select: { id: true, waitlistPosition: true },
  })

  for (let i = 0; i < waiting.length; i++) {
    if (waiting[i].waitlistPosition !== i + 1) {
      await prisma.sessionRegistration.update({
        where: { id: waiting[i].id },
        data: { waitlistPosition: i + 1 },
      })
    }
  }
}
