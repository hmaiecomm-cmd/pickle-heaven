'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getAdminContext } from '@/lib/admin-auth'
import { AdminAccessError, createInvitation, revokeInvitation, unbindLine } from '@/server/admin-line-access'

type R = { ok: true; message: string; link?: string } | { ok: false; error: string }

async function ctxOrFail() {
  const ctx = await getAdminContext()
  if (!ctx) throw new AdminAccessError('請先登入')
  return ctx
}

function fail(err: unknown): R {
  if (err instanceof AdminAccessError) return { ok: false, error: err.message }
  console.error('[admin-line] 操作失敗', err)
  return { ok: false, error: '操作失敗，請稍後再試' }
}

export async function createInviteAction(_: R | null, form: FormData): Promise<R> {
  try {
    const ctx = await ctxOrFail()
    const { token, invitation } = await createInvitation(
      {
        role: String(form.get('role') ?? ''),
        venueId: String(form.get('venueId') ?? '') || null,
        hours: Number(form.get('hours') ?? 72),
        note: String(form.get('note') ?? ''),
      },
      ctx,
    )
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    revalidatePath('/admin/settings/line')
    return { ok: true, message: `邀請已建立，有效至 ${invitation.expiresAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`, link: `${proto}://${host}/admin/login/invite/${token}` }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeInviteAction(id: string): Promise<R> {
  try {
    await revokeInvitation(id, await ctxOrFail())
    revalidatePath('/admin/settings/line')
    return { ok: true, message: '已撤銷邀請' }
  } catch (err) {
    return fail(err)
  }
}

export async function unbindAction(id: string): Promise<R> {
  try {
    await unbindLine(id, await ctxOrFail())
    revalidatePath('/admin/settings/line')
    return { ok: true, message: '已解除綁定' }
  } catch (err) {
    return fail(err)
  }
}
