'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

const profileSchema = z.object({
  displayName: z.string().trim().min(1, '請填寫顯示名稱').max(40, '名稱最多 40 字'),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^0\d{8,9}$/, '手機號碼格式不正確'),
})

/** 更新顯示名稱與手機 */
export async function updateProfile(input: { displayName: string; phone: string }): Promise<Result<{ displayName: string; phone: string | null }>> {
  try {
    const user = await requireUser()
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? '資料格式不正確' }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName, phone: parsed.data.phone || null },
      select: { displayName: true, phone: true },
    })
    return { ok: true, ...updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '更新失敗' }
  }
}
