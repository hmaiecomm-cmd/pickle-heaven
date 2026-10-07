'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PermissionError, requirePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'

/** 會員限制與黑名單：需要「會員限制」權限，必須填寫原因，撤銷也保留紀錄 */

type R = { ok: true } | { ok: false; error: string }

const addSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['BLACKLIST', 'NO_ACTIVITY']),
  reason: z.string().trim().min(2, '請填寫原因').max(300),
  days: z.number().int().min(0).max(3650),
})

export async function addRestrictionAction(input: z.infer<typeof addSchema>): Promise<R> {
  try {
    const ctx = await requirePermission('members.restrict')
    const v = addSchema.parse(input)
    const user = await prisma.user.findUnique({ where: { id: v.userId }, select: { id: true, displayName: true } })
    if (!user) return { ok: false, error: '找不到會員' }
    await prisma.memberRestriction.create({
      data: {
        userId: v.userId,
        type: v.type,
        reason: v.reason,
        createdBy: `admin:${ctx.username}`,
        expiresAt: v.days > 0 ? new Date(now().getTime() + v.days * 86_400_000) : null,
      },
    })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'MEMBER_RESTRICT', target: user.displayName, detail: { userId: v.userId, type: v.type, reason: v.reason, days: v.days } } })
    revalidatePath(`/admin/members/${v.userId}`)
    revalidatePath('/admin/members/restrictions')
    return { ok: true }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有會員限制的權限' }
    if (err instanceof z.ZodError) return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤' }
    throw err
  }
}

export async function revokeRestrictionAction(id: string, reason: string): Promise<R> {
  try {
    const ctx = await requirePermission('members.restrict')
    if (!reason.trim()) return { ok: false, error: '請填寫解除原因' }
    const r = await prisma.memberRestriction.findUnique({ where: { id }, include: { user: { select: { displayName: true } } } })
    if (!r || r.revokedAt) return { ok: false, error: '這筆限制已解除' }
    await prisma.memberRestriction.update({ where: { id }, data: { revokedAt: now(), revokedBy: `admin:${ctx.username}`, revokeReason: reason.trim().slice(0, 300) } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'MEMBER_UNRESTRICT', target: r.user.displayName, detail: { restrictionId: id, reason } } })
    revalidatePath(`/admin/members/${r.userId}`)
    revalidatePath('/admin/members/restrictions')
    return { ok: true }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有會員限制的權限' }
    throw err
  }
}
