import 'server-only'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { activityTimeLabel, planOccurrences, parseIdList, shortDateLabel, MAX_OCCURRENCES } from '@/lib/activity-shared'
import { formatDateTime, now, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { findConflicts, occupyMaintenance, OccupancyConflictError, releaseMaintenance, validateRange, type Conflict } from './occupancy'

/**
 * 清潔／維護排程（內部排程，不是活動）：
 *  - 不開放報名、不進購物車、不顯示價格與名額、不出現在前台活動推薦。
 *  - 生效後占用場地（Reservation.status = BLOCKED，指向 MaintenanceEvent），前台顯示「清潔維護・暫不開放」。
 *  - 每次事件獨立建立占用，跨多面場地全部成功才算完成；衝突不覆蓋既有訂單。
 *  - 標記完成不釋放封場；提前開放需「提前解除封場」。延長時間會再次檢查後續預約。
 */

const TX = { maxWait: 15_000, timeout: 30_000 }
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式錯誤')

export class MaintenanceError extends Error {}

export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  CLEANING: '清潔',
  DISINFECT: '消毒',
  EQUIPMENT: '設備保養',
  REPAIR: '場地維修',
}
export const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: '已排程',
  IN_PROGRESS: '進行中',
  DONE: '完成',
  CANCELLED: '取消',
}

export const maintenanceInputSchema = z
  .object({
    name: z.string().trim().min(1, '請填寫名稱').max(60),
    type: z.enum(['CLEANING', 'DISINFECT', 'EQUIPMENT', 'REPAIR']),
    courtIds: z.array(z.string()).min(1, '請至少選擇一面場地'),
    startMinute: z.number().int().min(0).max(2880),
    endMinute: z.number().int().min(0).max(2880),
    repeatKind: z.enum(['ONCE', 'WEEKLY']),
    weekdays: z.array(z.number().int().min(0).max(6)),
    intervalWeeks: z.number().int().min(1).max(8),
    seriesStartDate: dateStr,
    seriesEndDate: dateStr.nullable(),
    occurrenceCount: z.number().int().min(1).max(MAX_OCCURRENCES).nullable(),
    skipDates: z.array(dateStr).max(200),
    assignee: z.string().trim().max(60).nullable(),
    description: z.string().trim().max(2000).nullable(),
    checklist: z.string().trim().max(2000).nullable(),
  })
  .refine((v) => v.endMinute > v.startMinute, { message: '結束時間必須晚於開始時間', path: ['endMinute'] })
export type MaintenanceInput = z.infer<typeof maintenanceInputSchema>

async function primaryVenue() {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { orderBy: { sortOrder: 'asc' } } } })
  if (!venue) throw new MaintenanceError('尚未設定場館')
  return venue
}

export interface MaintenancePreviewRow {
  date: string
  dateLabel: string
  timeLabel: string
  courtNames: string[]
  status: 'NEW' | 'CONFLICT' | 'PAST'
  conflicts: Conflict[]
}

/** 列出將建立的清潔事件與衝突（不寫入） */
export async function previewMaintenance(raw: unknown): Promise<{ ok: boolean; error: string | null; rows: MaintenancePreviewRow[]; skipped: string[] }> {
  const parsed = maintenanceInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? '輸入資料有誤', rows: [], skipped: [] }
  const v = parsed.data
  const venue = await primaryVenue()
  const rangeError = validateRange(venue, v.startMinute, v.endMinute)
  if (rangeError) return { ok: false, error: rangeError, rows: [], skipped: [] }
  const courts = venue.courts.filter((c) => v.courtIds.includes(c.id))
  if (courts.length !== v.courtIds.length) return { ok: false, error: '場地資料有誤', rows: [], skipped: [] }

  const plan = planOccurrences({
    repeatKind: v.repeatKind,
    weekdays: v.weekdays,
    intervalWeeks: v.intervalWeeks,
    seriesStartDate: v.seriesStartDate,
    seriesEndDate: v.repeatKind === 'ONCE' ? null : v.seriesEndDate,
    occurrenceCount: v.repeatKind === 'ONCE' ? 1 : v.occurrenceCount,
    skipDates: v.skipDates,
  })
  if (plan.error) return { ok: false, error: plan.error, rows: [], skipped: [] }

  const conflicts = await findConflicts({ venue, courts, ranges: plan.dates.map((d) => ({ date: d, startMinute: v.startMinute, endMinute: v.endMinute })) })
  const at = now()
  const rows = plan.dates.map((d): MaintenancePreviewRow => {
    const c = conflicts.get(d) ?? []
    const past = taipeiToUtc(d, v.endMinute) <= at
    return {
      date: d,
      dateLabel: shortDateLabel(d),
      timeLabel: activityTimeLabel(v.startMinute, v.endMinute),
      courtNames: courts.map((x) => x.name),
      status: past ? 'PAST' : c.length > 0 ? 'CONFLICT' : 'NEW',
      conflicts: past ? [] : c,
    }
  })
  return { ok: true, error: null, rows, skipped: plan.skipped }
}

/** 建立排程：衝突日期必須明確排除，否則不建立；每次事件獨立占用（全部場地成功才成立） */
export async function createMaintenance(params: { input: unknown; excludeDates?: string[]; actor: string }) {
  const parsed = maintenanceInputSchema.safeParse(params.input)
  if (!parsed.success) throw new MaintenanceError(parsed.error.errors[0]?.message ?? '輸入資料有誤')
  let v = parsed.data
  const excluded = [...new Set(params.excludeDates ?? [])]
  if (excluded.length > 0) v = { ...v, skipDates: [...new Set([...v.skipDates, ...excluded])] }
  const preview = await previewMaintenance(v)
  if (!preview.ok) throw new MaintenanceError(preview.error ?? '設定有誤')
  const conflict = preview.rows.filter((r) => r.status === 'CONFLICT')
  if (conflict.length > 0) throw new MaintenanceError(`${conflict.map((r) => r.dateLabel).join('、')} 有衝突，請改時段、換場地或排除這些日期`)
  const rows = preview.rows.filter((r) => r.status === 'NEW')
  if (rows.length === 0) throw new MaintenanceError('沒有可建立的日期')

  const venue = await primaryVenue()
  const plan = await prisma.maintenancePlan.create({
    data: {
      venueId: venue.id,
      name: v.name,
      type: v.type,
      courtIds: v.courtIds.join(','),
      startMinute: v.startMinute,
      endMinute: v.endMinute,
      repeatKind: v.repeatKind,
      weekdays: v.weekdays.join(','),
      intervalWeeks: v.intervalWeeks,
      seriesStartDate: v.seriesStartDate,
      seriesEndDate: v.repeatKind === 'ONCE' ? null : v.seriesEndDate,
      occurrenceCount: v.repeatKind === 'ONCE' ? 1 : v.occurrenceCount,
      skipDates: [...new Set(v.skipDates)].sort().join(','),
      assignee: v.assignee || null,
      description: v.description || null,
      checklist: v.checklist || null,
      createdBy: params.actor,
    },
  })
  const created: string[] = []
  const failed: { date: string; reason: string }[] = []
  for (const r of rows) {
    try {
      await prisma.$transaction(async (tx) => {
        const ev = await tx.maintenanceEvent.create({
          data: { planId: plan.id, venueId: venue.id, date: r.date, startAt: taipeiToUtc(r.date, v.startMinute), endAt: taipeiToUtc(r.date, v.endMinute), courtIds: v.courtIds.join(',') },
        })
        await occupyMaintenance(tx, { eventId: ev.id, venue, courtIds: v.courtIds, date: r.date, startMinute: v.startMinute, endMinute: v.endMinute, note: v.name })
      }, TX)
      created.push(r.date)
    } catch (err) {
      failed.push({ date: r.date, reason: err instanceof OccupancyConflictError ? '預覽後場地被占用，未建立' : '建立失敗' })
      if (!(err instanceof OccupancyConflictError)) console.error('[maintenance] 建立事件失敗', err)
    }
  }
  await prisma.auditLog.create({ data: { actor: params.actor, action: 'MAINTENANCE_CREATE', target: v.name, detail: { planId: plan.id, created: created.length, failed, excluded } } })
  return { planId: plan.id, created, failed, excluded, message: `已建立 ${created.length} 次${excluded.length ? `，排除 ${excluded.length} 個衝突日期` : ''}${failed.length ? `，${failed.length} 次未建立` : ''}` }
}

async function loadEvent(eventId: string) {
  const ev = await prisma.maintenanceEvent.findUnique({ where: { id: eventId }, include: { plan: true } })
  if (!ev) throw new MaintenanceError('找不到這次排程')
  return ev
}

/** 開始／完成：完成不釋放封場 */
export async function setMaintenanceStatus(eventId: string, status: 'IN_PROGRESS' | 'DONE', actor: string) {
  const ev = await loadEvent(eventId)
  if (ev.status === 'CANCELLED') throw new MaintenanceError('這次排程已取消')
  await prisma.maintenanceEvent.update({ where: { id: eventId }, data: { status, ...(status === 'IN_PROGRESS' ? { startedAt: now() } : { completedAt: now() }) } })
  await prisma.auditLog.create({ data: { actor, action: `MAINTENANCE_${status}`, target: ev.plan.name, detail: { eventId, date: ev.date } } })
}

/** 提前解除封場：釋放尚未開始的時段格（完成與解除是兩個不同操作） */
export async function releaseMaintenanceEarly(eventId: string, actor: string) {
  const ev = await loadEvent(eventId)
  if (ev.status === 'CANCELLED') throw new MaintenanceError('這次排程已取消')
  const at = now()
  const released = await prisma.$transaction(async (tx) => {
    const n = await releaseMaintenance(tx, eventId, at)
    await tx.maintenanceEvent.update({ where: { id: eventId }, data: { releasedAt: at, ...(ev.status === 'SCHEDULED' || ev.status === 'IN_PROGRESS' ? { status: 'DONE', completedAt: ev.completedAt ?? at } : {}) } })
    return n
  }, TX)
  await prisma.auditLog.create({ data: { actor, action: 'MAINTENANCE_RELEASE', target: ev.plan.name, detail: { eventId, date: ev.date, releasedSlots: released } } })
  return { released }
}

/** 延長結束時間：先檢查新增區間的衝突，有衝突不覆蓋 */
export async function extendMaintenance(eventId: string, newEndMinute: number, actor: string) {
  const ev = await loadEvent(eventId)
  if (ev.status === 'CANCELLED' || ev.releasedAt) throw new MaintenanceError('已取消或已解除封場的排程不能延長')
  const venue = await primaryVenue()
  const start = taipeiMinuteOfDay(ev.startAt)
  const curEnd = start + Math.round((ev.endAt.getTime() - ev.startAt.getTime()) / 60_000)
  if (newEndMinute <= curEnd) throw new MaintenanceError('新的結束時間必須晚於目前結束時間')
  const rangeError = validateRange(venue, start, newEndMinute)
  if (rangeError) throw new MaintenanceError(rangeError)
  const courtIds = parseIdList(ev.courtIds)
  const courts = venue.courts.filter((c) => courtIds.includes(c.id))
  const conflicts = (await findConflicts({ venue, courts, ranges: [{ date: ev.date, startMinute: curEnd, endMinute: newEndMinute }], excludeMaintenanceEventIds: [eventId] })).get(ev.date) ?? []
  if (conflicts.length > 0) {
    throw new MaintenanceError(`延長後與既有安排衝突：${conflicts.map((c) => `${c.courtName} ${activityTimeLabel(c.startMinute, c.endMinute)} ${c.reason}`).join('；')}`)
  }
  try {
    await prisma.$transaction(async (tx) => {
      await occupyMaintenance(tx, { eventId, venue, courtIds, date: ev.date, startMinute: curEnd, endMinute: newEndMinute, note: ev.plan.name })
      await tx.maintenanceEvent.update({ where: { id: eventId }, data: { endAt: taipeiToUtc(ev.date, newEndMinute) } })
    }, TX)
  } catch (err) {
    if (err instanceof OccupancyConflictError) throw new MaintenanceError('檢查後時段剛被占用，未延長')
    throw err
  }
  await prisma.auditLog.create({ data: { actor, action: 'MAINTENANCE_EXTEND', target: ev.plan.name, detail: { eventId, date: ev.date, from: curEnd, to: newEndMinute } } })
}

/** 取消單次：只解除本筆事件的封場 */
export async function cancelMaintenanceEvent(eventId: string, reason: string, actor: string) {
  const ev = await loadEvent(eventId)
  if (ev.status === 'CANCELLED') return
  await prisma.$transaction(async (tx) => {
    await releaseMaintenance(tx, eventId)
    await tx.maintenanceEvent.update({ where: { id: eventId }, data: { status: 'CANCELLED', cancelReason: reason.trim() || null } })
  }, TX)
  await prisma.auditLog.create({ data: { actor, action: 'MAINTENANCE_CANCEL', target: ev.plan.name, detail: { eventId, date: ev.date, reason } } })
}

/** 取消整個排程：未來的事件全部取消並釋放 */
export async function cancelMaintenancePlan(planId: string, actor: string) {
  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } })
  if (!plan) throw new MaintenanceError('找不到排程')
  const future = await prisma.maintenanceEvent.findMany({ where: { planId, status: { not: 'CANCELLED' }, endAt: { gt: now() } }, select: { id: true } })
  await prisma.$transaction(async (tx) => {
    for (const ev of future) {
      await releaseMaintenance(tx, ev.id)
      await tx.maintenanceEvent.update({ where: { id: ev.id }, data: { status: 'CANCELLED', cancelReason: '排程取消' } })
    }
    await tx.maintenancePlan.update({ where: { id: planId }, data: { status: 'CANCELLED' } })
  }, TX)
  await prisma.auditLog.create({ data: { actor, action: 'MAINTENANCE_PLAN_CANCEL', target: plan.name, detail: { planId, cancelled: future.length } } })
  return { cancelled: future.length }
}

/** 後台列表：排程與近期事件 */
export async function listMaintenance() {
  const venue = await primaryVenue()
  const courtName = new Map(venue.courts.map((c) => [c.id, c.name]))
  const since = new Date(now().getTime() - 7 * 86_400_000)
  const [plans, events] = await Promise.all([
    prisma.maintenancePlan.findMany({ where: { venueId: venue.id }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: { _count: { select: { events: true } } } }),
    prisma.maintenanceEvent.findMany({ where: { venueId: venue.id, endAt: { gt: since } }, orderBy: { startAt: 'asc' }, include: { plan: { select: { name: true, type: true, assignee: true, checklist: true } }, _count: { select: { occupancy: true } } }, take: 200 }),
  ])
  return {
    courts: venue.courts.map((c) => ({ id: c.id, name: c.name, active: c.active })),
    venue: { openMinute: venue.openMinute, closeMinute: venue.closeMinute, slotMinutes: venue.slotMinutes },
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      typeLabel: MAINTENANCE_TYPE_LABEL[p.type] ?? p.type,
      courtNames: parseIdList(p.courtIds).map((id) => courtName.get(id) ?? '?'),
      timeLabel: activityTimeLabel(p.startMinute, p.endMinute),
      repeatKind: p.repeatKind,
      weekdays: p.weekdays,
      assignee: p.assignee,
      status: p.status,
      eventCount: p._count.events,
    })),
    events: events.map((e) => {
      const start = taipeiMinuteOfDay(e.startAt)
      const end = start + Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60_000)
      return {
        id: e.id,
        planId: e.planId,
        name: e.plan.name,
        type: e.plan.type,
        typeLabel: MAINTENANCE_TYPE_LABEL[e.plan.type] ?? e.plan.type,
        date: e.date,
        dateLabel: shortDateLabel(e.date),
        startMinute: start,
        endMinute: end,
        timeLabel: activityTimeLabel(start, end),
        courtNames: parseIdList(e.courtIds).map((id) => courtName.get(id) ?? '?'),
        assignee: e.plan.assignee,
        checklist: e.plan.checklist,
        status: e.status,
        statusLabel: MAINTENANCE_STATUS_LABEL[e.status] ?? e.status,
        occupied: e._count.occupancy > 0,
        releasedAt: e.releasedAt ? formatDateTime(e.releasedAt) : null,
        completedAt: e.completedAt ? formatDateTime(e.completedAt) : null,
        ended: e.endAt <= now(),
        today: e.date === taipeiDateString(),
      }
    }),
  }
}
