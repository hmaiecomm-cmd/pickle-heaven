'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PermissionError, requirePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { adminAdjustPoints, PointsError } from './points-ledger'

/**
 * 人員管理操作：會員限制／黑名單、點數帳本、使用券、內部備註、教練身分。
 * 所有操作在後端驗證權限並寫入操作紀錄；點數與票券異動採帳本與防重複提交。
 */

type R<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string }

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有這項操作的權限' }
  if (err instanceof z.ZodError) return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤' }
  if (err instanceof PointsError) return { ok: false, error: err.message }
  console.error('[member-admin]', err)
  return { ok: false, error: '系統忙碌中，請稍後再試' }
}

function refresh(userId: string) {
  revalidatePath(`/admin/members/${userId}`)
  revalidatePath('/admin/members')
  revalidatePath('/admin/members/restrictions')
  revalidatePath('/admin/members/points')
  revalidatePath('/account')
}

/* ─────────────── 限制與黑名單 ─────────────── */

const addSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['BLACKLIST', 'NO_ACTIVITY']),
  reason: z.string().trim().min(2, '請填寫原因').max(300),
  /** 0 = 永久 */
  days: z.number().int().min(0).max(3650),
  internalNote: z.string().trim().max(500).nullable().default(null),
})

export async function addRestrictionAction(input: z.infer<typeof addSchema>): Promise<R> {
  try {
    const ctx = await requirePermission('members.restrict')
    const v = addSchema.parse(input)
    const user = await prisma.user.findUnique({ where: { id: v.userId }, select: { id: true, displayName: true } })
    if (!user) return { ok: false, error: '找不到會員' }
    // 黑名單是帳戶限制狀態，不改角色；以會員主鍵（Google 身分）關聯，改名或改 Email 不會解除
    await prisma.memberRestriction.create({
      data: {
        userId: v.userId,
        type: v.type,
        reason: v.reason,
        internalNote: v.internalNote,
        createdBy: `admin:${ctx.username}`,
        expiresAt: v.days > 0 ? new Date(now().getTime() + v.days * 86_400_000) : null,
      },
    })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: v.type === 'BLACKLIST' ? 'MEMBER_BLACKLIST' : 'MEMBER_RESTRICT', target: v.userId, detail: { name: user.displayName, type: v.type, reason: v.reason, days: v.days, permanent: v.days === 0 } } })
    refresh(v.userId)
    return { ok: true, message: v.type === 'BLACKLIST' ? '已加入黑名單；該會員不能新增預約、報名與消費，仍可登入查看本人資料' : '已設定限制' }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeRestrictionAction(id: string, reason: string): Promise<R> {
  try {
    const ctx = await requirePermission('members.restrict')
    if (!reason.trim()) return { ok: false, error: '請填寫解除原因' }
    const r = await prisma.memberRestriction.findUnique({ where: { id }, include: { user: { select: { displayName: true } } } })
    if (!r || r.revokedAt) return { ok: false, error: '這筆限制已解除' }
    await prisma.memberRestriction.update({ where: { id }, data: { revokedAt: now(), revokedBy: `admin:${ctx.username}`, revokeReason: reason.trim().slice(0, 300) } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'MEMBER_UNRESTRICT', target: r.userId, detail: { name: r.user.displayName, restrictionId: id, type: r.type, reason } } })
    refresh(r.userId)
    return { ok: true, message: '已解除；原有角色與資格恢復' }
  } catch (err) {
    return fail(err)
  }
}

/* ─────────────── 點數帳本 ─────────────── */

const pointsSchema = z.object({
  userId: z.string().min(1),
  delta: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100_000, '數量需為 ±1～100000'),
  reason: z.string().trim().min(2, '請填寫原因').max(200),
  idempotencyKey: z.string().min(8).max(80),
})

/** 加點／扣點：帳本記錄、餘額不得為負、同一 idempotencyKey 不重複 */
export async function adjustPointsAction(input: z.infer<typeof pointsSchema>): Promise<R<{ balanceBefore: number; balanceAfter: number; duplicate: boolean }>> {
  try {
    const ctx = await requirePermission('finance.adjust')
    const v = pointsSchema.parse(input)
    const res = await adminAdjustPoints({ userId: v.userId, delta: v.delta, reason: v.reason, actor: `admin:${ctx.username}`, idempotencyKey: `admin:${v.idempotencyKey}` })
    if (!res.duplicate) {
      await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: v.delta > 0 ? 'POINTS_ADD' : 'POINTS_DEDUCT', target: v.userId, detail: { name: res.displayName, delta: v.delta, before: res.balanceBefore, after: res.balanceAfter, reason: v.reason } } })
    }
    refresh(v.userId)
    return { ok: true, balanceBefore: res.balanceBefore, balanceAfter: res.balanceAfter, duplicate: res.duplicate, message: res.duplicate ? '這筆異動先前已完成，未重複執行' : `已${v.delta > 0 ? '加' : '扣'} ${Math.abs(v.delta)} 點，餘額 ${res.balanceAfter}` }
  } catch (err) {
    return fail(err)
  }
}

/* ─────────────── 使用券 ─────────────── */

const voucherSchema = z.object({
  userId: z.string().min(1),
  ticketKind: z.enum(['OFFPEAK', 'PEAK', 'GENERAL']),
  units: z.number().int().min(1).max(100),
  count: z.number().int().min(1).max(50),
  courtIds: z.array(z.string()),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  reason: z.string().trim().min(2, '請填寫發放原因').max(200),
  idempotencyKey: z.string().min(8).max(80),
})

const TICKET_LABEL: Record<string, string> = { OFFPEAK: '離峰券', PEAK: '尖峰券', GENERAL: '通用券' }

function voucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'T'
  for (let i = 0; i < 9; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** 發放使用券：張數、每張時數、適用場地、有效期、原因；以 idempotencyKey 防重複發放 */
export async function issueVoucherAction(input: z.infer<typeof voucherSchema>): Promise<R<{ codes: string[] }>> {
  try {
    const ctx = await requirePermission('finance.adjust')
    const v = voucherSchema.parse(input)
    const user = await prisma.user.findUnique({ where: { id: v.userId }, select: { displayName: true } })
    if (!user) return { ok: false, error: '找不到會員' }
    const courts = await prisma.court.findMany({ where: { id: { in: v.courtIds }, active: true }, select: { id: true } })
    if (courts.length !== v.courtIds.length) return { ok: false, error: '場地資料有誤' }
    const issueKey = `issue:${v.idempotencyKey}`
    const already = await prisma.voucher.findMany({ where: { issueReason: { startsWith: `[${issueKey}]` } }, select: { code: true } })
    if (already.length > 0) return { ok: true, codes: already.map((x) => x.code), message: '這批票券先前已發放，未重複發放' }
    const codes: string[] = []
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < v.count; i++) {
        const code = voucherCode()
        await tx.voucher.create({
          data: {
            code,
            title: `${TICKET_LABEL[v.ticketKind]} ${v.units} 小時`,
            type: 'AMOUNT',
            value: 0,
            userId: v.userId,
            ticketKind: v.ticketKind,
            units: v.units,
            courtIds: v.courtIds.join(','),
            expiresAt: v.expiresAt ? new Date(`${v.expiresAt}T23:59:59+08:00`) : null,
            issuedBy: `admin:${ctx.username}`,
            issueReason: `[${issueKey}] ${v.reason}`,
          },
        })
        codes.push(code)
      }
    })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'VOUCHER_ISSUE', target: v.userId, detail: { name: user.displayName, kind: v.ticketKind, units: v.units, count: v.count, courtIds: v.courtIds, expiresAt: v.expiresAt, reason: v.reason, codes } } })
    refresh(v.userId)
    return { ok: true, codes, message: `已發放 ${codes.length} 張${TICKET_LABEL[v.ticketKind]}` }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeVoucherAction(voucherId: string, reason: string): Promise<R> {
  try {
    const ctx = await requirePermission('finance.adjust')
    if (!reason.trim()) return { ok: false, error: '請填寫撤銷原因' }
    const v = await prisma.voucher.findUnique({ where: { id: voucherId } })
    if (!v || !v.userId) return { ok: false, error: '找不到票券' }
    if (v.usedAt || v.bookingId) return { ok: false, error: '已核銷的票券不能撤銷（歷史保留）' }
    if (v.revokedAt) return { ok: false, error: '這張票券已撤銷' }
    await prisma.voucher.update({ where: { id: voucherId }, data: { revokedAt: now(), revokedBy: `admin:${ctx.username}`, revokeReason: reason.trim().slice(0, 200) } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'VOUCHER_REVOKE', target: v.userId, detail: { code: v.code, reason } } })
    refresh(v.userId)
    return { ok: true, message: '已撤銷票券' }
  } catch (err) {
    return fail(err)
  }
}

/* ─────────────── 備註與教練身分 ─────────────── */

export async function setAdminNoteAction(userId: string, note: string): Promise<R> {
  try {
    const ctx = await requirePermission('members')
    const u = await prisma.user.update({ where: { id: userId }, data: { adminNote: note.trim().slice(0, 1000) || null }, select: { displayName: true } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'MEMBER_NOTE', target: userId, detail: { name: u.displayName, length: note.trim().length } } })
    refresh(userId)
    return { ok: true, message: '已儲存內部備註' }
  } catch (err) {
    return fail(err)
  }
}

/** 教練身分與後台角色分開；不會授予後台權限 */
export async function setCoachFlagAction(userId: string, isCoach: boolean): Promise<R> {
  try {
    const ctx = await requirePermission('members.restrict')
    const u = await prisma.user.update({ where: { id: userId }, data: { isCoach }, select: { displayName: true } })
    await prisma.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: isCoach ? 'MEMBER_COACH_ON' : 'MEMBER_COACH_OFF', target: userId, detail: { name: u.displayName } } })
    refresh(userId)
    return { ok: true, message: isCoach ? '已標記為教練（不含後台權限）' : '已取消教練身分' }
  } catch (err) {
    return fail(err)
  }
}
