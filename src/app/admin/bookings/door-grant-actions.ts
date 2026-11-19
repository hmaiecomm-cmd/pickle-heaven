'use server'

import { PermissionError, requirePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { grantPhase, PHASE_LABEL, syncGrantForBooking, type GrantPhase } from '@/server/door-access-grants'

export interface BookingGrantView {
  holderName: string
  holderPhone: string | null
  validFrom: string
  validUntil: string
  phase: GrantPhase
  phaseLabel: string
  revokeReason: string | null
}

type R<T> = { ok: true; data: T } | { ok: false; error: string }

const view = (g: { holderName: string; holderPhone: string | null; validFrom: Date; validUntil: Date; status: string; revokeReason: string | null }): BookingGrantView => {
  const phase = grantPhase(g)
  return {
    holderName: g.holderName,
    holderPhone: g.holderPhone ? g.holderPhone.replace(/^(\d{4})\d+(\d{3})$/, '$1***$2') : null,
    validFrom: g.validFrom.toISOString(),
    validUntil: g.validUntil.toISOString(),
    phase,
    phaseLabel: PHASE_LABEL[phase],
    revokeReason: g.revokeReason,
  }
}

async function run<T>(permission: 'access' | 'access.grant', fn: (actor: string) => Promise<T>): Promise<R<T>> {
  try {
    const ctx = await requirePermission(permission)
    return { ok: true, data: await fn(`admin:${ctx.username}`) }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有門禁授權的權限' }
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[bookings] door grant action failed', err)
    return { ok: false, error: '讀取門禁授權失敗，請稍後再試' }
  }
}

/** 這筆訂單對應的預約授權（一張訂單最多一筆） */
export async function bookingGrantAction(bookingId: string): Promise<R<BookingGrantView | null>> {
  return run('access', async () => {
    const g = await prisma.doorAccessGrant.findUnique({ where: { bookingId } })
    return g ? view(g) : null
  })
}

/** 依訂單目前狀態補建授權；只在已付款、有有效時段且會員未列黑名單時才會建立 */
export async function createBookingGrantAction(bookingId: string): Promise<R<{ result: string; grant: BookingGrantView | null }>> {
  return run('access.grant', async (actor) => {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { code: true } })
    if (!booking) return { result: 'skipped', grant: null }
    const result = await syncGrantForBooking(bookingId)
    await prisma.auditLog.create({ data: { actor, action: 'DOOR_GRANT_SYNC_FROM_ORDER', target: booking.code, detail: { result } } })
    const g = await prisma.doorAccessGrant.findUnique({ where: { bookingId } })
    return { result, grant: g ? view(g) : null }
  })
}
