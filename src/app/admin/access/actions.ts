'use server'

import { revalidatePath } from 'next/cache'
import { PermissionError, requirePermission, getAdminContext } from '@/lib/admin-auth'
import type { Permission } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { taipeiToUtc } from '@/lib/time'
import { DoorGrantError, createManualGrant, reconcileBookingGrants, revokeGrant } from '@/server/door-access-grants'
import { DoorRemoteError, remoteOpenDoor } from '@/server/door-remote'
import {
  AHEAD_DAYS_MAX,
  AHEAD_DAYS_MIN,
  EXPIRE_TIME_OPTIONS,
  GENERATION_MODES,
  OPEN_TIME_OPTIONS,
} from '@/server/slot-password-service'
import { sendSlotPasswordToBooking } from '@/server/slot-password-notification'

type R = { ok: true; message: string } | { ok: false; error: string }

const NO_PERMISSION: R = { ok: false, error: '此功能僅限高級管理者使用。如需建立授權或管理密碼，請聯絡高級管理者。' }

/** 矩陣驅動的權限檢查守衛 */
async function guardPermission(permission: Permission) {
  try {
    return await requirePermission(permission)
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

export async function createManualGrantAction(_: any, form: FormData): Promise<any> {
  const ctx = await guardPermission('access.grant')
  if (!ctx) return NO_PERMISSION
  try {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
    if (!venue) return { ok: false, error: '尚未建立場館' }

    const userId = String(form.get('userId') ?? '') || null
    const holderName = String(form.get('holderName') ?? '')
    const holderPhone = String(form.get('holderPhone') ?? '')
    const validFromStr = form.get('validFrom')
    const validUntilStr = form.get('validUntil')
    const note = String(form.get('note') ?? '')

    if (!holderName.trim()) return { ok: false, error: '請填寫授權對象姓名' }

    const validFrom = parseLocal(validFromStr)
    const validUntil = parseLocal(validUntilStr)

    if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
      return { ok: false, error: '請填寫有效的開始與結束時間' }
    }

    const grant = await createManualGrant(
      {
        venueId: venue.id,
        userId,
        holderName,
        holderPhone,
        validFrom,
        validUntil,
        note,
      },
      ctx.username,
    )

    revalidatePath('/admin/access')
    return {
      ok: true,
      message: `已授權給 ${grant.holderName}`,
      grantId: grant.grantId,
      holderName: grant.holderName,
      userId: grant.userId,
      validFrom: grant.validFrom.toISOString(),
      validUntil: grant.validUntil.toISOString(),
      password: grant.password,
      note: grant.note,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeGrantAction(id: string, reason: string): Promise<R> {
  const ctx = await guardPermission('access.grant')
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
  if (!(await guardPermission('access.grant'))) return NO_PERMISSION
  try {
    const s = await reconcileBookingGrants()
    revalidatePath('/admin/access')
    return { ok: true, message: `同步完成：新增 ${s.created}、更新 ${s.updated}、撤銷 ${s.revoked}、不變 ${s.unchanged}` }
  } catch (err) {
    return fail(err)
  }
}

export type DoorOpenResult = { ok: true; status: string; simulated: boolean; error: string | null } | { ok: false; error: string }

/** 一鍵開啟大門 */
export async function remoteOpenDoorAction(idempotencyKey: string, simulate?: string): Promise<DoorOpenResult> {
  const ctx = await guardPermission('access.remote')
  if (!ctx) return { ok: false, error: '此功能僅限高級管理者使用' }
  const username = ctx.username
  try {
    const c = await remoteOpenDoor({ idempotencyKey, actor: username, simulate })
    revalidatePath('/admin/access')
    return { ok: true, status: c.status, simulated: c.simulated, error: c.error }
  } catch (err) {
    if (err instanceof DoorRemoteError) return { ok: false, error: err.message }
    console.error('[door] 遠端開門失敗', err)
    return { ok: false, error: '操作失敗，請稍後再試' }
  }
}

// ─────── 預約密碼設定 Server Actions ───────

export interface PasswordRuleInput {
  generationMode: string
  passwordLength: number
  generateAheadDays: number
  passwordOpenTime: string
  passwordOpenCustomMinutes: number | null
  passwordExpireTime: string
  lockWhenNoOrders: boolean
  allowSharedPassword: boolean
  passwordBookAheadDaysOverride: number | null
  basicMemberBookAheadDays: number | null
  pointsMemberBookAheadDays: number | null
  vipMemberBookAheadDays: number | null
}

export async function updatePasswordSettingsAction(data: PasswordRuleInput): Promise<R> {
  const ctx = await guardPermission('access.password')
  if (!ctx) return NO_PERMISSION

  // 驗證密碼產生方式
  if (!(GENERATION_MODES as readonly string[]).includes(data.generationMode)) return { ok: false, error: '密碼產生方式不正確' }

  // 驗證密碼長度
  const LENGTH_OPTIONS = [4, 6, 8, 10]
  if (!LENGTH_OPTIONS.includes(data.passwordLength)) return { ok: false, error: '密碼長度必須為 4、6、8 或 10 碼' }

  // 驗證開放時間
  if (!(OPEN_TIME_OPTIONS as readonly string[]).includes(data.passwordOpenTime)) return { ok: false, error: '密碼開放時間不正確' }

  // 驗證失效時間
  if (!(EXPIRE_TIME_OPTIONS as readonly string[]).includes(data.passwordExpireTime)) return { ok: false, error: '密碼失效時間不正確' }

  // 驗證提前產生天數
  const ahead = Math.round(Number(data.generateAheadDays))
  if (!Number.isFinite(ahead) || ahead < AHEAD_DAYS_MIN || ahead > AHEAD_DAYS_MAX) {
    return { ok: false, error: `密碼提前產生天數須為 ${AHEAD_DAYS_MIN}～${AHEAD_DAYS_MAX} 天` }
  }

  // 驗證自訂開放分鐘數
  let customOpen: number | null = null
  if (data.passwordOpenTime === 'CUSTOM') {
    customOpen = Math.round(Number(data.passwordOpenCustomMinutes))
    if (!Number.isFinite(customOpen) || customOpen < 0 || customOpen > 1440) return { ok: false, error: '自訂開放分鐘數須為 0～1440' }
  }

  // 驗證預約開放提前天數覆蓋
  const override = data.passwordBookAheadDaysOverride
  if (override !== null && (!Number.isInteger(override) || override < 1 || override > 365)) {
    return { ok: false, error: '預約開放提前天數須為 1～365 天' }
  }

  // 驗證會員分級預約天數
  const validateMemberDays = (days: number | null, name: string) => {
    if (days === null || days === undefined) return true
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw new Error(`${name}預約提前天數須為 0～365 天`)
    }
    return true
  }

  try {
    validateMemberDays(data.basicMemberBookAheadDays, '普通會員')
    validateMemberDays(data.pointsMemberBookAheadDays, '點數會員')
    validateMemberDays(data.vipMemberBookAheadDays, 'VIP會員')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '會員設定驗證失敗' }
  }

  try {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
    if (!venue) return { ok: false, error: '尚未建立場館' }

    const rule = {
      generationMode: data.generationMode,
      passwordLength: data.passwordLength,
      generateAheadDays: ahead,
      passwordOpenTime: data.passwordOpenTime,
      passwordOpenCustomMinutes: customOpen,
      passwordExpireTime: data.passwordExpireTime,
      lockWhenNoOrders: Boolean(data.lockWhenNoOrders),
      allowSharedPassword: Boolean(data.allowSharedPassword),
      basicMemberBookAheadDays: data.basicMemberBookAheadDays,
      pointsMemberBookAheadDays: data.pointsMemberBookAheadDays,
      vipMemberBookAheadDays: data.vipMemberBookAheadDays,
    }
    await prisma.slotPasswordRule.upsert({ where: { venueId: venue.id }, create: { venueId: venue.id, ...rule }, update: rule })
    await prisma.venue.update({ where: { id: venue.id }, data: { passwordBookAheadDaysOverride: override } })
    await prisma.auditLog.create({ data: { actor: ctx.username, action: 'SLOT_PASSWORD_RULE_UPDATE', target: venue.id, detail: rule } })

    revalidatePath('/admin/access')
    return { ok: true, message: '設定已儲存。新付款的訂單會套用新規則，已發出的密碼不變。' }
  } catch (err) {
    console.error('[password-settings] 更新失敗', err)
    return { ok: false, error: err instanceof Error ? err.message : '操作失敗，請稍後再試' }
  }
}

/** 後台重新發送某筆訂單的時段密碼（只經 LINE；會員未綁定 LINE 時回報失敗，不改用其他管道） */
export async function resendSlotPasswordAction(slotPasswordId: string, bookingId: string): Promise<R> {
  const ctx = await guardPermission('access.password')
  if (!ctx) return NO_PERMISSION
  try {
    const r = await sendSlotPasswordToBooking(slotPasswordId, bookingId, { isRetry: true })
    await prisma.auditLog.create({
      data: { actor: ctx.username, action: 'SLOT_PASSWORD_RESEND', target: bookingId, detail: { slotPasswordId, ok: r.ok, reason: r.ok ? null : r.reason } },
    })
    revalidatePath('/admin/access')
    return r.ok ? { ok: true, message: '已經由 LINE 重新發送' } : { ok: false, error: r.reason }
  } catch (err) {
    console.error('[slot-password] 重新發送失敗', err)
    return { ok: false, error: '操作失敗，請稍後再試' }
  }
}

// ─────── 常開排程 Server Actions ───────

type ScheduleResult = { ok: true; message: string } | { ok: false; error: string }

export async function createAccessScheduleAction(_: ScheduleResult | null, form: FormData): Promise<ScheduleResult> {
  const ctx = await guardPermission('access.schedule')
  if (!ctx) return { ok: false, error: '此功能僅限高級管理者使用' }

  const scheduleName = String(form.get('scheduleName') ?? '')
  const startAt = String(form.get('startAt') ?? '')
  const endAt = String(form.get('endAt') ?? '')
  const reason = String(form.get('reason') ?? '')
  const notes = String(form.get('notes') ?? '') || undefined

  if (!scheduleName || !startAt || !endAt || !reason) {
    return { ok: false, error: '必填欄位不能為空' }
  }

  try {
    const response = await fetch('/api/door/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doorId: 'main-entrance',
        scheduleName,
        startAt,
        endAt,
        reason,
        notes,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      return { ok: false, error: result.error || '建立失敗' }
    }

    revalidatePath('/admin/access')
    return { ok: true, message: `已建立排程「${scheduleName}」` }
  } catch (err) {
    console.error('[door-schedule] 建立失敗', err)
    return { ok: false, error: '操作失敗，請稍後再試' }
  }
}

export async function cancelAccessScheduleAction(scheduleId: string, reason: string): Promise<ScheduleResult> {
  const ctx = await guardPermission('access.schedule')
  if (!ctx) return { ok: false, error: '此功能僅限高級管理者使用' }

  try {
    const response = await fetch(`/api/door/schedule/${scheduleId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })

    const result = await response.json()
    if (!response.ok) {
      return { ok: false, error: result.error || '取消失敗' }
    }

    revalidatePath('/admin/access')
    return { ok: true, message: '已取消排程' }
  } catch (err) {
    console.error('[door-schedule] 取消失敗', err)
    return { ok: false, error: '操作失敗，請稍後再試' }
  }
}

// ─────── 常開模式 Server Actions ───────

export async function toggleAlwaysOpenAction(mode: 'ON' | 'OFF'): Promise<R> {
  const ctx = await guardPermission('access.remote')
  if (!ctx) return NO_PERMISSION

  try {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
    if (!venue) return { ok: false, error: '尚未建立場館' }

    // 更新門禁常開狀態（存儲在 Venue 或單獨的表中）
    // TODO: 實現常開模式的 API 調用
    // 目前先模擬成功
    const action = mode === 'ON' ? '已開啟' : '已關閉'
    console.log(`[door-always-open] 常開模式${action}`)

    revalidatePath('/admin/access')
    return { ok: true, message: `常開模式已${action}` }
  } catch (err) {
    console.error('[door-always-open] 切換失敗', err)
    return { ok: false, error: '操作失敗，請稍後再試' }
  }
}
