'use server'

import { revalidatePath } from 'next/cache'
import { CancellationMode, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { permissionDenied, requirePermission } from '@/lib/admin-auth'
import { describeWeekdays, formatWeekdays } from '@/lib/session-schedule'
import { generateUpcomingSessions } from './session-scheduler'

/**
 * 週期性球敘範本的管理（規格 §10、§14、§20）。
 *
 * 範本只描述「每週哪幾天（或每天）、幾點到幾點、幾人、什麼規則」，實際場次由排程依範本產生。
 * 這裡改動範本後只影響之後產生的場次，已存在的場次不會被回溯修改——
 * 否則已經報名的人會突然發現規則變了。
 */

export type TemplateResult = { ok: boolean; message: string }

export type TemplateInput = {
  title: string
  /// 重複的星期，0=週日 … 6=週六；七天全選即「每天」
  weekdays: number[]
  startMinute: number
  endMinute: number
  capacity: number
  reservedCapacity: number
  skillLevelMin: number | null
  skillLevelMax: number | null
  price: number
  bookingOpenDaysBefore: number
  bookingOpenHourOffset: number
  cancellationMode: CancellationMode
  cancellationHoursBefore: number | null
  waitlistEnabled: boolean
  autoPromote: boolean
  allowPostLockReplacement: boolean
  generateWeeksAhead: number
  active: boolean
}

function validate(input: TemplateInput): string | null {
  if (!input.title.trim()) return '請輸入名稱'
  if (input.weekdays.length === 0) return '請至少選一天'
  if (input.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return '星期設定不正確'
  if (input.endMinute <= input.startMinute) return '結束時間必須晚於開始時間'
  if (input.capacity < 1) return '容量至少要 1 人'
  if (input.reservedCapacity < 0 || input.reservedCapacity >= input.capacity) {
    return '保留名額必須小於總容量'
  }
  if (input.price < 0) return '價格不能是負數'
  if (input.bookingOpenDaysBefore < 0) return '報名開放天數不能是負數'
  if (input.generateWeeksAhead < 1 || input.generateWeeksAhead > 52) {
    return '預先產生週數請設在 1–52 之間'
  }
  if (
    input.cancellationMode === CancellationMode.HOURS_BEFORE_START &&
    (input.cancellationHoursBefore == null || input.cancellationHoursBefore < 0)
  ) {
    return '請填寫開打前幾小時截止'
  }
  return null
}

/** 表單資料轉成資料表欄位；weekday 取第一天，只用於排序與舊資料相容。 */
function toData(input: TemplateInput) {
  const { weekdays, ...rest } = input
  const days = formatWeekdays(weekdays)
  return { ...rest, title: input.title.trim(), weekdays: days, weekday: Number(days.split(',')[0]) }
}

export async function createTemplate(input: TemplateInput): Promise<TemplateResult> {
  { const d = await permissionDenied('activities'); if (d) return { ok: false, message: d } }

  const error = validate(input)
  if (error) return { ok: false, message: error }

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
  if (!venue) return { ok: false, message: '尚未建立任何場館' }

  await prisma.sessionTemplate.create({
    data: { ...toData(input), organizationId: venue.organizationId, venueId: venue.id },
  })

  // 建好就立刻產生場次，不必等下一輪排程
  const generated = input.active ? await generateUpcomingSessions() : null
  refreshAll()

  return {
    ok: true,
    message: generated
      ? `已建立${describeWeekdays(input.weekdays)}的球敘，產生 ${generated.sessionsCreated} 場`
      : '範本已建立（停用中，不會產生場次）',
  }
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<TemplateResult> {
  { const d = await permissionDenied('activities'); if (d) return { ok: false, message: d } }

  const error = validate(input)
  if (error) return { ok: false, message: error }

  await prisma.sessionTemplate.update({ where: { id }, data: toData(input) })

  revalidatePath('/admin/templates')
  return { ok: true, message: '範本已更新。已產生的場次不受影響，按「立即產生」可補上新增的星期。' }
}

/**
 * 刪除範本，並清掉它尚未開打的場次。
 *
 * 沒人報名的未來場次直接刪除；已經有人報名的改為「已取消」並保留名單，
 * 讓球友看得到這場停辦了，而不是報名紀錄憑空消失。
 * 已開打或已結束的場次保留作為歷史紀錄（templateId 會被設為 null）。
 */
export async function deleteTemplate(id: string): Promise<TemplateResult> {
  { const d = await permissionDenied('activities'); if (d) return { ok: false, message: d } }

  const template = await prisma.sessionTemplate.findUnique({ where: { id } })
  if (!template) return { ok: false, message: '找不到這個範本' }

  const future = await prisma.session.findMany({
    where: {
      templateId: id,
      deletedAt: null,
      startAt: { gt: new Date() },
      status: { in: [SessionStatus.DRAFT, SessionStatus.SCHEDULED, SessionStatus.OPEN, SessionStatus.FULL, SessionStatus.LOCKED] },
    },
    select: {
      id: true,
      _count: {
        select: {
          registrations: {
            where: { status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
          },
        },
      },
    },
  })

  const empty = future.filter((s) => s._count.registrations === 0).map((s) => s.id)
  const withPlayers = future.filter((s) => s._count.registrations > 0).map((s) => s.id)

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { id: { in: empty } } })
    await tx.session.updateMany({
      where: { id: { in: withPlayers } },
      data: { status: SessionStatus.CANCELLED, cancelReason: '主辦已停辦此重複球敘' },
    })
    await tx.sessionTemplate.delete({ where: { id } })
  })

  refreshAll()
  return {
    ok: true,
    message:
      withPlayers.length > 0
        ? `已刪除，移除 ${empty.length} 場；${withPlayers.length} 場已有人報名，改為取消`
        : `已刪除，移除 ${empty.length} 場未來場次`,
  }
}

function refreshAll() {
  revalidatePath('/admin/templates')
  revalidatePath('/admin/sessions')
  revalidatePath('/sessions')
}

export async function toggleTemplate(id: string, active: boolean): Promise<TemplateResult> {
  { const d = await permissionDenied('activities'); if (d) return { ok: false, message: d } }
  await prisma.sessionTemplate.update({ where: { id }, data: { active } })
  revalidatePath('/admin/templates')
  return { ok: true, message: active ? '範本已啟用' : '範本已停用，不再產生新場次' }
}

/** 立刻依所有啟用中的範本補足未來場次，不必等排程。 */
export async function generateNow(): Promise<TemplateResult> {
  { const d = await permissionDenied('activities'); if (d) return { ok: false, message: d } }

  const result = await generateUpcomingSessions()
  revalidatePath('/admin/templates')
  revalidatePath('/admin/sessions')
  revalidatePath('/sessions')

  return {
    ok: true,
    message: `新增 ${result.sessionsCreated} 場，已存在 ${result.alreadyExisted} 場`,
  }
}
