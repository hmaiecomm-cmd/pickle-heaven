'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminContext, hashPassword, normalizeUsername } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { clientFor, isDemoConfigured, mainPrisma } from '@/lib/db'
import { seedDemoData } from './demo-seed'

/**
 * 員工帳號與權限（只有擁有者、且在正式資料範圍內才能操作）。
 * 帳號存在正式資料庫；展示帳號看不到也改不到。
 */

type R = { ok: true; message?: string } | { ok: false; error: string }

async function owner() {
  const ctx = await getAdminContext()
  if (!ctx || ctx.tenant !== 'main' || !can(ctx.role, 'staff')) return null
  return ctx
}

const createSchema = z.object({
  username: z.string().trim().min(3, '帳號至少 3 個字').max(32).regex(/^[A-Za-z0-9._-]+$/, '帳號只能用英數字與 . _ -'),
  displayName: z.string().trim().min(1).max(40),
  role: z.enum(['MANAGER', 'STAFF']),
  password: z.string().min(10, '初始密碼至少 10 個字').max(100),
})

export async function createStaffAction(input: z.infer<typeof createSchema>): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理員工帳號' }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? '輸入資料有誤' }
  const v = parsed.data
  const key = normalizeUsername(v.username)
  if (key === 'demo') return { ok: false, error: '這個帳號名稱保留給展示帳號' }
  const exists = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: key } })
  if (exists) return { ok: false, error: '帳號已存在' }
  await mainPrisma.adminAccount.create({
    data: { username: v.username, usernameKey: key, displayName: v.displayName, role: v.role, tenant: 'main', passwordHash: await hashPassword(v.password), createdBy: `admin:${ctx.username}` },
  })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'STAFF_CREATE', target: v.username, detail: { role: v.role } } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: '已建立帳號，請另行告知初始密碼' }
}

export async function setStaffActiveAction(accountId: string, active: boolean): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理員工帳號' }
  if (accountId === ctx.accountId) return { ok: false, error: '不能停用自己的帳號' }
  const acc = await mainPrisma.adminAccount.update({ where: { id: accountId }, data: { active } })
  // 停用時立即登出該帳號的所有 session
  if (!active) await mainPrisma.adminSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: active ? 'STAFF_ENABLE' : 'STAFF_DISABLE', target: acc.username } })
  revalidatePath('/admin/settings/staff')
  return { ok: true }
}

export async function resetStaffPasswordAction(accountId: string, password: string): Promise<R> {
  const ctx = await owner()
  if (!ctx) return { ok: false, error: '只有擁有者可以管理員工帳號' }
  if (password.length < 10) return { ok: false, error: '新密碼至少 10 個字' }
  const acc = await mainPrisma.adminAccount.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(password) } })
  await mainPrisma.adminSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } })
  await mainPrisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'STAFF_PASSWORD_RESET', target: acc.username } })
  revalidatePath('/admin/settings/staff')
  return { ok: true, message: '已重設密碼，該帳號需重新登入' }
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
