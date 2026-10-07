'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminContext, hashPassword, normalizeUsername, verifyPassword } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { clientFor, isDemoConfigured, mainPrisma } from '@/lib/db'
import { seedDemoData } from './demo-seed'

/**
 * 後台帳號與權限（只有擁有者、且在正式資料範圍內才能操作）。
 * 帳號存在正式資料庫；展示帳號看不到也改不到。
 * 密碼一律雜湊保存，重設或建立後不會再顯示；停用與降權會立即撤銷該帳號的 session。
 */

type R = { ok: true; message?: string } | { ok: false; error: string }

async function owner() {
  const ctx = await getAdminContext()
  if (!ctx || ctx.tenant !== 'main' || !can(ctx.role, 'staff')) return null
  return ctx
}

/** 最後一位有效擁有者不能被停用或降權 */
export async function countOtherActiveOwners(exceptAccountId: string): Promise<number> {
  return mainPrisma.adminAccount.count({ where: { role: 'OWNER', active: true, tenant: 'main', id: { not: exceptAccountId } } })
}

const createSchema = z.object({
  username: z.string().trim().min(3, '帳號至少 3 個字').max(32).regex(/^[A-Za-z0-9._-]+$/, '帳號只能用英數字與 . _ -'),
  displayName: z.string().trim().min(1, '請填寫顯示名稱').max(40),
  role: z.enum(['MANAGER', 'STAFF']),
  password: z.string().min(10, '初始密碼至少 10 個字').max(100),
  venueId: z.string().nullable().default(null),
})

export async function createStaffAction(input: z.infer<typeof createSchema>): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理後台帳號' }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? '輸入資料有誤' }
  const v = parsed.data
  const key = normalizeUsername(v.username)
  if (key === 'demo') return { ok: false, error: '這個帳號名稱保留給展示帳號' }
  const exists = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: key } })
  if (exists) return { ok: false, error: '帳號已存在' }
  if (v.venueId) {
    const venue = await mainPrisma.venue.findUnique({ where: { id: v.venueId }, select: { id: true } })
    if (!venue) return { ok: false, error: '授權場館不存在' }
  }
  await mainPrisma.adminAccount.create({
    data: {
      username: v.username,
      usernameKey: key,
      displayName: v.displayName,
      role: v.role,
      tenant: 'main',
      venueId: v.venueId,
      passwordHash: await hashPassword(v.password),
      mustChangePassword: true,
      createdBy: `admin:${ctx.username}`,
    },
  })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'STAFF_CREATE', target: v.username, detail: { role: v.role, venueId: v.venueId } } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: '已建立帳號。請另行告知初始密碼；對方首次登入時必須更換密碼' }
}

export async function setStaffActiveAction(accountId: string, active: boolean): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理後台帳號' }
  if (accountId === ctx.accountId) return { ok: false, error: '不能停用自己的帳號' }
  const target = await mainPrisma.adminAccount.findUnique({ where: { id: accountId } })
  if (!target || target.tenant !== 'main') return { ok: false, error: '找不到帳號' }
  if (!active && target.role === 'OWNER' && (await countOtherActiveOwners(accountId)) === 0) return { ok: false, error: '不能停用最後一位有效的擁有者' }
  const acc = await mainPrisma.adminAccount.update({ where: { id: accountId }, data: { active } })
  // 停用時立即登出該帳號的所有 session（下一次請求即失效）
  if (!active) await mainPrisma.adminSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: active ? 'STAFF_ENABLE' : 'STAFF_DISABLE', target: acc.username } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: active ? '已啟用' : '已停用，該帳號的登入即刻失效' }
}

/** 指派角色：擁有者可將帳號設為管理員／工作人員，或轉移擁有者；不能改自己的角色 */
export async function setStaffRoleAction(accountId: string, role: 'OWNER' | 'MANAGER' | 'STAFF'): Promise<R> {
  const ctx = await owner()
  if (!ctx || ctx.role !== 'OWNER') return { ok: false, error: '只有擁有者可以指派角色' }
  if (accountId === ctx.accountId) return { ok: false, error: '不能修改自己的角色；請由另一位擁有者操作' }
  const target = await mainPrisma.adminAccount.findUnique({ where: { id: accountId } })
  if (!target || target.tenant !== 'main') return { ok: false, error: '找不到帳號' }
  if (target.role === role) return { ok: true, message: '角色未變更' }
  if (target.role === 'OWNER' && role !== 'OWNER' && target.active && (await countOtherActiveOwners(accountId)) === 0) {
    return { ok: false, error: '不能降低最後一位有效擁有者的角色' }
  }
  await mainPrisma.adminAccount.update({ where: { id: accountId }, data: { role } })
  // 權限變動：撤銷既有 session，下一次請求即以新角色（或需重新登入）生效
  await mainPrisma.adminSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: role === 'OWNER' ? 'STAFF_OWNER_TRANSFER' : 'STAFF_ROLE', target: target.username, detail: { from: target.role, to: role } } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: role === 'OWNER' ? '已指派為擁有者；對方需重新登入' : '已更新角色；對方需重新登入' }
}

export async function resetStaffPasswordAction(accountId: string, password: string): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理後台帳號' }
  if (password.length < 10) return { ok: false, error: '新密碼至少 10 個字' }
  const target = await mainPrisma.adminAccount.findUnique({ where: { id: accountId } })
  if (!target || target.tenant !== 'main') return { ok: false, error: '找不到帳號' }
  const acc = await mainPrisma.adminAccount.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } })
  await mainPrisma.adminSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'STAFF_PASSWORD_RESET', target: acc.username } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: '已重設密碼；該帳號需重新登入並更換密碼' }
}

/** 本人變更密碼（首次登入強制、或自行更換） */
export async function changeOwnPasswordAction(input: { current: string; next: string }): Promise<R> {
  const ctx = await getAdminContext()
  if (!ctx) return { ok: false, error: '請先登入' }
  if (ctx.tenant !== 'main') return { ok: false, error: '展示帳號不能更換密碼' }
  if (input.next.length < 10) return { ok: false, error: '新密碼至少 10 個字' }
  if (input.next === input.current) return { ok: false, error: '新密碼不能與目前密碼相同' }
  const acc = await mainPrisma.adminAccount.findUnique({ where: { id: ctx.accountId } })
  if (!acc) return { ok: false, error: '找不到帳號' }
  if (!(await verifyPassword(input.current, acc.passwordHash))) return { ok: false, error: '目前密碼不正確' }
  await mainPrisma.adminAccount.update({ where: { id: acc.id }, data: { passwordHash: await hashPassword(input.next), mustChangePassword: false } })
  // 其他裝置的 session 全部登出，只保留目前這一個
  await mainPrisma.adminSession.updateMany({ where: { accountId: acc.id, revokedAt: null, id: { not: ctx.sessionId } }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'STAFF_PASSWORD_CHANGE', target: acc.username } })
  return { ok: true, message: '密碼已更新' }
}

/** 重置展示資料：只影響展示資料庫，不碰正式資料 */
export async function resetDemoDataAction(): Promise<R> {
  const ctx = await owner()
  if (!ctx || ctx.role !== 'OWNER') return { ok: false, error: '只有擁有者可以重置展示資料' }
  if (!isDemoConfigured()) return { ok: false, error: '展示資料庫尚未設定' }
  await seedDemoData(clientFor('demo'))
  // 展示帳號的 session 全部登出，避免畫面停在已不存在的資料
  const demo = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: 'demo' } })
  if (demo) await mainPrisma.adminSession.updateMany({ where: { accountId: demo.id, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'DEMO_DATA_RESET', target: 'demo' } })
  return { ok: true, message: '展示資料已重置' }
}
