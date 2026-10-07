'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PermissionError, requirePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { creditTopUpOrder, TopUpError } from './topup-service'

type R<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string }

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有這項操作的權限' }
  if (err instanceof z.ZodError) return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤' }
  if (err instanceof TopUpError) return { ok: false, error: err.message }
  console.error('[topup-admin]', err)
  return { ok: false, error: '系統忙碌中，請稍後再試' }
}

const planSchema = z.object({
  id: z.string().nullable().default(null),
  name: z.string().trim().min(1, '請填寫方案名稱').max(40),
  price: z.number().int().min(1, '支付金額需大於 0').max(1_000_000),
  points: z.number().int().min(1, '購買點數需大於 0').max(1_000_000),
  bonusPoints: z.number().int().min(0).max(1_000_000),
  scopeNote: z.string().trim().max(200).nullable().default(null),
  validityNote: z.string().trim().max(200).nullable().default(null),
  refundNote: z.string().trim().max(300).nullable().default(null),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).default(0),
})

/** 建立或更新儲值方案（擁有者）。既有儲值單保留方案快照，修改方案不回寫已成立的儲值單。 */
export async function savePlanAction(input: z.infer<typeof planSchema>): Promise<R<{ id: string }>> {
  try {
    const ctx = await requirePermission('settings')
    const v = planSchema.parse(input)
    const data = { name: v.name, price: v.price, points: v.points, bonusPoints: v.bonusPoints, scopeNote: v.scopeNote || null, validityNote: v.validityNote || null, refundNote: v.refundNote || null, active: v.active, sortOrder: v.sortOrder }
    const plan = v.id
      ? await prisma.topUpPlan.update({ where: { id: v.id }, data })
      : await prisma.topUpPlan.create({ data: { ...data, createdBy: `admin:${ctx.username}` } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: v.id ? 'TOPUP_PLAN_UPDATE' : 'TOPUP_PLAN_CREATE', target: plan.id, detail: data } })
    revalidatePath('/admin/settings/topup')
    revalidatePath('/account/topup')
    return { ok: true, id: plan.id, message: v.id ? '已更新方案' : '已建立方案' }
  } catch (err) {
    return fail(err)
  }
}

export async function setPlanActiveAction(id: string, active: boolean): Promise<R> {
  try {
    const ctx = await requirePermission('settings')
    const plan = await prisma.topUpPlan.update({ where: { id }, data: { active } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: active ? 'TOPUP_PLAN_ON' : 'TOPUP_PLAN_OFF', target: plan.id, detail: { name: plan.name } } })
    revalidatePath('/admin/settings/topup')
    revalidatePath('/account/topup')
    return { ok: true, message: active ? '已上架' : '已下架' }
  } catch (err) {
    return fail(err)
  }
}

/** 已收款但入帳失敗的儲值單：由擁有者安全補入（帳本鍵固定，不會重複入點） */
export async function creditTopUpAction(orderId: string): Promise<R<{ status: string }>> {
  try {
    const ctx = await requirePermission('finance.adjust')
    const res = await creditTopUpOrder(orderId, `admin:${ctx.username}`)
    revalidatePath('/admin/topup')
    revalidatePath('/account')
    return { ok: true, status: res.status, message: res.credited ? '已補入點數' : res.status === 'CREDITED' ? '這筆先前已入帳，未重複入點' : `目前狀態「${res.status}」不能補入` }
  } catch (err) {
    return fail(err)
  }
}
