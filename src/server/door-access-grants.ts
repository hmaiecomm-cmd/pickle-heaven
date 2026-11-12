import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { activeRestrictions } from './member-restrictions'

/**
 * 門禁授權（業務層）。決定「誰、在什麼期間可以進入」，不直接操作門禁硬體。
 *
 * 預約授權：訂單付款成功 → 會員不在黑名單 → 依仍有效的場地／活動明細計算期間（前後各加緩衝）→ 建立授權。
 * 訂單取消、逾時或待退款時自動撤銷；管理者手動撤銷的授權不會被自動恢復。
 */

export const ACCESS_BUFFER_BEFORE_MINUTES = 15
export const ACCESS_BUFFER_AFTER_MINUTES = 15
const SYSTEM_ACTOR = 'system'
const MAX_MANUAL_DAYS = 366

export type GrantPhase = 'UPCOMING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export const PHASE_LABEL: Record<GrantPhase, string> = {
  UPCOMING: '尚未生效',
  ACTIVE: '有效中',
  EXPIRED: '已過期',
  REVOKED: '已撤銷',
}

export function grantPhase(g: { status: string; validFrom: Date; validUntil: Date }, at: Date = now()): GrantPhase {
  if (g.status === 'REVOKED') return 'REVOKED'
  if (at < g.validFrom) return 'UPCOMING'
  if (at >= g.validUntil) return 'EXPIRED'
  return 'ACTIVE'
}

export class DoorGrantError extends Error {}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actor, action, target, detail: detail as Prisma.InputJsonValue } })
}

type SyncResult = 'created' | 'updated' | 'revoked' | 'unchanged' | 'skipped'

/** 依訂單目前狀態建立、更新或撤銷對應的預約授權（可重複執行） */
export async function syncGrantForBooking(bookingId: string): Promise<SyncResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { displayName: true, phone: true } },
      items: { where: { status: 'ACTIVE' }, select: { startsAt: true, endsAt: true } },
      activityItems: { where: { status: 'ACTIVE' }, select: { startsAt: true, endsAt: true } },
    },
  })
  if (!booking) return 'skipped'
  const existing = await prisma.doorAccessGrant.findUnique({ where: { bookingId } })

  const slots = [...booking.items, ...booking.activityItems]
  const window = slots.length
    ? {
        from: new Date(Math.min(...slots.map((s) => s.startsAt.getTime())) - ACCESS_BUFFER_BEFORE_MINUTES * 60_000),
        until: new Date(Math.max(...slots.map((s) => s.endsAt.getTime())) + ACCESS_BUFFER_AFTER_MINUTES * 60_000),
      }
    : null
  const paid = booking.status === 'PAID' || booking.status === 'COMPLETED'
  const blacklisted = (await activeRestrictions(booking.userId)).some((r) => r.type === 'BLACKLIST')

  if (paid && window && !blacklisted) {
    if (!existing) {
      await prisma.doorAccessGrant.create({
        data: {
          venueId: booking.venueId,
          source: 'BOOKING',
          bookingId,
          userId: booking.userId,
          holderName: booking.user.displayName,
          holderPhone: booking.user.phone,
          validFrom: window.from,
          validUntil: window.until,
          createdBy: SYSTEM_ACTOR,
        },
      })
      await audit(SYSTEM_ACTOR, 'DOOR_GRANT_AUTO_CREATE', booking.code, { validFrom: window.from, validUntil: window.until })
      return 'created'
    }
    // 管理者手動撤銷的授權，尊重管理者決定，不自動恢復
    if (existing.status === 'REVOKED' && existing.revokedBy !== SYSTEM_ACTOR) return 'unchanged'
    const same = existing.status === 'ACTIVE' && existing.validFrom.getTime() === window.from.getTime() && existing.validUntil.getTime() === window.until.getTime()
    if (same) return 'unchanged'
    await prisma.doorAccessGrant.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', validFrom: window.from, validUntil: window.until, revokedAt: null, revokedBy: null, revokeReason: null },
    })
    await audit(SYSTEM_ACTOR, 'DOOR_GRANT_AUTO_UPDATE', booking.code, { validFrom: window.from, validUntil: window.until })
    return 'updated'
  }

  if (existing && existing.status === 'ACTIVE') {
    const reason = blacklisted ? '會員已列入黑名單' : '訂單已取消／退款'
    await prisma.doorAccessGrant.update({
      where: { id: existing.id },
      data: { status: 'REVOKED', revokedAt: now(), revokedBy: SYSTEM_ACTOR, revokeReason: reason },
    })
    await audit(SYSTEM_ACTOR, 'DOOR_GRANT_AUTO_REVOKE', booking.code, { reason, bookingStatus: booking.status })
    return 'revoked'
  }
  return 'unchanged'
}

/** 給訂單流程呼叫：門禁同步失敗不能影響付款或取消本身 */
export async function syncGrantForBookingSafe(bookingId: string): Promise<void> {
  try {
    await syncGrantForBooking(bookingId)
  } catch (err) {
    console.error('[door] 門禁授權同步失敗', bookingId, err)
  }
}

/** 補同步：已付款的訂單、以及仍有效的預約授權，逐一比對 */
export async function reconcileBookingGrants(): Promise<Record<SyncResult, number>> {
  const at = now()
  const [paid, activeGrants] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: 'PAID',
        OR: [{ items: { some: { endsAt: { gt: at } } } }, { activityItems: { some: { endsAt: { gt: at } } } }],
      },
      select: { id: true },
    }),
    prisma.doorAccessGrant.findMany({ where: { source: 'BOOKING', status: 'ACTIVE', validUntil: { gt: at } }, select: { bookingId: true } }),
  ])
  const ids = new Set([...paid.map((b) => b.id), ...activeGrants.map((g) => g.bookingId).filter((x): x is string => Boolean(x))])
  const summary: Record<SyncResult, number> = { created: 0, updated: 0, revoked: 0, unchanged: 0, skipped: 0 }
  for (const id of ids) summary[await syncGrantForBooking(id)]++
  return summary
}

export interface ManualGrantInput {
  venueId: string
  userId?: string | null
  holderName: string
  holderPhone?: string | null
  validFrom: Date
  validUntil: Date
  note?: string | null
}

export async function createManualGrant(input: ManualGrantInput, actor: string) {
  const at = now()
  if (!(input.validFrom instanceof Date) || isNaN(input.validFrom.getTime()) || isNaN(input.validUntil.getTime())) throw new DoorGrantError('請填寫有效的開始與結束時間')
  if (input.validUntil <= input.validFrom) throw new DoorGrantError('結束時間必須晚於開始時間')
  if (input.validUntil <= at) throw new DoorGrantError('結束時間已經過去')
  if (input.validUntil.getTime() - input.validFrom.getTime() > MAX_MANUAL_DAYS * 86_400_000) throw new DoorGrantError(`單次手動授權最長 ${MAX_MANUAL_DAYS} 天`)

  let holderName = input.holderName.trim()
  let holderPhone = input.holderPhone?.trim() || null
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, displayName: true, phone: true } })
    if (!user) throw new DoorGrantError('找不到這位會員')
    if ((await activeRestrictions(user.id)).some((r) => r.type === 'BLACKLIST')) throw new DoorGrantError('這位會員目前在黑名單中，無法授權')
    holderName = holderName || user.displayName
    holderPhone = holderPhone || user.phone
  }
  if (!holderName) throw new DoorGrantError('請填寫授權對象姓名')
  if (holderName.length > 50) throw new DoorGrantError('姓名過長')

  const grant = await prisma.doorAccessGrant.create({
    data: {
      venueId: input.venueId,
      source: 'MANUAL',
      userId: input.userId || null,
      holderName,
      holderPhone,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      note: input.note?.trim().slice(0, 200) || null,
      createdBy: actor,
    },
  })
  await audit(actor, 'DOOR_GRANT_MANUAL_CREATE', holderName, { grantId: grant.id, validFrom: grant.validFrom, validUntil: grant.validUntil, userId: grant.userId })
  return grant
}

export async function revokeGrant(id: string, reason: string, actor: string) {
  const r = reason.trim()
  if (!r) throw new DoorGrantError('請填寫撤銷原因')
  const grant = await prisma.doorAccessGrant.findUnique({ where: { id } })
  if (!grant) throw new DoorGrantError('找不到這筆授權')
  if (grant.status !== 'ACTIVE') throw new DoorGrantError('這筆授權已經撤銷')
  if (grantPhase(grant) === 'EXPIRED') throw new DoorGrantError('這筆授權已過期，不需要撤銷')
  await prisma.doorAccessGrant.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: now(), revokedBy: actor, revokeReason: r.slice(0, 200) },
  })
  await audit(actor, 'DOOR_GRANT_REVOKE', grant.holderName, { grantId: id, reason: r, source: grant.source, bookingId: grant.bookingId })
}

export async function listGrants() {
  return prisma.doorAccessGrant.findMany({ orderBy: [{ validFrom: 'desc' }], take: 300 })
}

export async function listDoorAudit() {
  return prisma.auditLog.findMany({ where: { action: { startsWith: 'DOOR_' } }, orderBy: { createdAt: 'desc' }, take: 100 })
}
