'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requirePermission, PermissionError } from '@/lib/admin-auth'
import type { Permission } from '@/lib/admin-permissions'
import { isUniqueViolation } from './occupancy'

/** 檢查權限，回傳操作者名稱；沒有權限丟出 PermissionError */
async function need(p: Permission): Promise<string> {
  return (await requirePermission(p)).username
}
const denied = (err: unknown): AdminResult | null => (err instanceof PermissionError ? { ok: false, error: '目前帳號沒有這項操作的權限' } : null)
import { taipeiToUtc } from '@/lib/time'
import { cancelBooking } from './booking-service'

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string }

/** 鎖定時段（場館維護、教學課程等） */
export async function blockSlot(
  courtId: string,
  dateStr: string,
  startMinute: number,
  note: string,
): Promise<AdminResult> {
  let admin: string
  try {
    admin = await need('courts.manage')
  } catch (err) {
    return denied(err) ?? { ok: false, error: '操作失敗' }
  }

  const court = await prisma.court.findUnique({ where: { id: courtId }, include: { venue: true } })
  if (!court) return { ok: false, error: '找不到場地' }

  const startsAt = taipeiToUtc(dateStr, startMinute)
  const endsAt = taipeiToUtc(dateStr, startMinute + court.venue.slotMinutes)

  try {
    await prisma.reservation.create({
      data: { courtId, startsAt, endsAt, status: 'BLOCKED', note: note || '場館維護' },
    })
    await prisma.auditLog.create({
      data: { actor: admin, action: 'SLOT_BLOCKED', target: `${court.name} ${dateStr} ${startMinute}`, detail: { note } },
    })
    revalidatePath('/admin/schedule')
    return { ok: true, message: '已鎖定該時段' }
  } catch (err) {
    if (isUniqueViolation(err) || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      return { ok: false, error: '此時段已有預約或已鎖定' }
    }
    throw err
  }
}

/** 解除鎖定（僅能解除 BLOCKED，不會影響客人的訂單） */
export async function unblockSlot(courtId: string, dateStr: string, startMinute: number): Promise<AdminResult> {
  let admin: string
  try {
    admin = await need('courts.manage')
  } catch (err) {
    return denied(err) ?? { ok: false, error: '操作失敗' }
  }
  const startsAt = taipeiToUtc(dateStr, startMinute)

  const res = await prisma.reservation.deleteMany({ where: { courtId, startsAt, status: 'BLOCKED' } })
  if (res.count === 0) return { ok: false, error: '此時段並非鎖定狀態' }

  await prisma.auditLog.create({
    data: { actor: admin, action: 'SLOT_UNBLOCKED', target: `${courtId} ${dateStr} ${startMinute}` },
  })
  revalidatePath('/admin/schedule')
  return { ok: true, message: '已解除鎖定' }
}

/** 後台代為取消訂單（全額退還為點數） */
export async function adminCancelBooking(bookingId: string): Promise<AdminResult> {
  try {
    const admin = await need('refund')
    const result = await cancelBooking(bookingId, admin, { asAdmin: true, fullRefund: true })
    revalidatePath('/admin/bookings')
    return { ok: true, message: `已取消訂單，回補 ${result.refundPoints} 點` }
  } catch (err) {
    return denied(err) ?? { ok: false, error: err instanceof Error ? err.message : '取消失敗' }
  }
}

/** 手動標記訂單為已完成 */
export async function markCompleted(bookingId: string): Promise<AdminResult> {
  let admin: string
  try {
    admin = await need('bookings.manage')
  } catch (err) {
    return denied(err) ?? { ok: false, error: '操作失敗' }
  }
  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED' } })
  await prisma.auditLog.create({ data: { actor: admin, action: 'BOOKING_COMPLETED', target: bookingId } })
  revalidatePath('/admin/bookings')
  return { ok: true, message: '已標記為完成' }
}
