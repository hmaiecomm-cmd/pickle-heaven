'use server'

import { revalidatePath } from 'next/cache'
import { PermissionError, requirePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { taipeiToUtc } from '@/lib/time'
import { DoorGrantError, createManualGrant, reconcileBookingGrants, revokeGrant } from '@/server/door-access-grants'

type R = { ok: true; message: string } | { ok: false; error: string }

const NO_PERMISSION: R = { ok: false, error: '目前帳號沒有門禁授權的權限' }

/** 未登入時 requirePermission 會丟出導向登入頁的訊號，必須讓它往外傳，只攔「沒有權限」 */
async function guard() {
  try {
    return await requirePermission('device.control')
  } catch (err) {
    if (err instanceof PermissionError) return null
    throw err
  }
}

function fail(err: unknown): R {
  if (err instanceof DoorGrantError) return { ok: false, error: err.message }
  console.error('[door] 操作失敗', err)
  return { ok: false, error: '操作失敗，請稍後再試' }
}

/** 「YYYY-MM-DDTHH:mm」（台北時間）→ UTC */
function parseLocal(v: unknown): Date {
  const m = typeof v === 'string' ? v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/) : null
  if (!m) return new Date(NaN)
  return taipeiToUtc(m[1], Number(m[2]) * 60 + Number(m[3]))
}

export async function createManualGrantAction(_: R | null, form: FormData): Promise<R> {
  const ctx = await guard()
  if (!ctx) return NO_PERMISSION
  try {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
    if (!venue) return { ok: false, error: '尚未建立場館' }
    const grant = await createManualGrant(
      {
        venueId: venue.id,
        userId: String(form.get('userId') ?? '') || null,
        holderName: String(form.get('holderName') ?? ''),
        holderPhone: String(form.get('holderPhone') ?? ''),
        validFrom: parseLocal(form.get('validFrom')),
        validUntil: parseLocal(form.get('validUntil')),
        note: String(form.get('note') ?? ''),
      },
      ctx.username,
    )
    revalidatePath('/admin/access')
    return { ok: true, message: `已授權給 ${grant.holderName}` }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeGrantAction(id: string, reason: string): Promise<R> {
  const ctx = await guard()
  if (!ctx) return NO_PERMISSION
  try {
    await revokeGrant(id, reason, ctx.username)
    revalidatePath('/admin/access')
    return { ok: true, message: '已撤銷授權' }
  } catch (err) {
    return fail(err)
  }
}

export async function reconcileAction(): Promise<R> {
  if (!(await guard())) return NO_PERMISSION
  try {
    const s = await reconcileBookingGrants()
    revalidatePath('/admin/access')
    return { ok: true, message: `同步完成：新增 ${s.created}、更新 ${s.updated}、撤銷 ${s.revoked}、不變 ${s.unchanged}` }
  } catch (err) {
    return fail(err)
  }
}
