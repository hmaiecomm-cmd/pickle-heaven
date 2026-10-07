import 'server-only'
import { Prisma, RegistrationStatus, SessionStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { pushMessages } from '@/lib/line'
import { getPaymentProvider } from '@/lib/payments'
import {
  activityTimeLabel,
  MAX_OCCURRENCES,
  parseIdList,
  parseWeekdayList,
  planOccurrences,
  shortDateLabel,
  type RecurrenceRule,
} from '@/lib/activity-shared'
import { addDays, formatDateTime, now, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { findConflicts, occupyCourts, OccupancyConflictError, releaseOccupancy, validateRange, withBuffer, type Conflict } from './occupancy'
import { notifySeatWatchers, publicCapacity, seatsUsed } from './activity-service'
import { cancelBooking } from './booking-service'
import { deleteAssetIfUnused } from './media'

/**
 * 後台活動管理（匹克精靈）。
 *
 * 原則：
 *  - 每個日期是一筆獨立的 Session（各自的名額、報名狀態、訂單）。
 *  - 建立前先預覽：列出每個日期、時段、場地與衝突；衝突日期要管理者明確選擇排除，否則不發布。
 *  - 佔用寫進 Reservation（唯一索引），預覽後才被搶走的時段在寫入時會失敗並回報，不會覆蓋既有訂單。
 *  - 已結束、已取消的場次保留歷史，不再修改。
 *  - 影響已報名者的修改（時間、場地）必須先看過影響名單並確認，套用後通知當事人；已購價格永不回寫。
 */

const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 }

export class ActivityAdminError extends Error {}

/* ─────────────────────────── 輸入 ─────────────────────────── */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式錯誤')

export const activityInputSchema = z
  .object({
    title: z.string().trim().min(1, '請填寫活動名稱').max(60),
    type: z.enum(['OPEN_PLAY', 'BEGINNER', 'LESSON', 'SOCIAL', 'OTHER']),
    summary: z.string().trim().max(120).nullable(),
    description: z.string().trim().max(2000).nullable(),
    levelLabel: z.string().trim().max(40).nullable(),
    requirements: z.string().trim().max(500).nullable(),
    includes: z.string().trim().max(300).nullable(),
    refundNote: z.string().trim().max(500).nullable(),
    coverAssetId: z.string().nullable(),
    coverFocusX: z.number().int().min(0).max(100),
    coverFocusY: z.number().int().min(0).max(100),
    price: z.number().int().min(0, '費用不能是負數').max(100_000),
    priceUnit: z.enum(['PER_PERSON', 'PER_PAIR']),
    capacity: z.number().int().min(1, '名額至少 1 人').max(500),
    maxPerOrder: z.number().int().min(1).max(20),
    repeatKind: z.enum(['ONCE', 'WEEKLY']),
    weekdays: z.array(z.number().int().min(0).max(6)),
    intervalWeeks: z.number().int().min(1).max(8),
    startMinute: z.number().int().min(0).max(2880),
    endMinute: z.number().int().min(0).max(2880),
    seriesStartDate: dateStr,
    seriesEndDate: dateStr.nullable(),
    occurrenceCount: z.number().int().min(1).max(MAX_OCCURRENCES).nullable(),
    skipDates: z.array(dateStr).max(200),
    courtIds: z.array(z.string()).min(1, '請至少選擇一面場地'),
    openDaysBefore: z.number().int().min(0).max(60),
    openMinute: z.number().int().min(0).max(1439).nullable(),
    closeMinutesBefore: z.number().int().min(0).max(10_080),
    /** 公開方式：公開列表／僅連結／不公開（都會占用場地） */
    visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
    customTypeLabel: z.string().trim().max(30).nullable().default(null),
    locationNote: z.string().trim().max(300).nullable().default(null),
    bufferBeforeMinutes: z.number().int().min(0).max(120).default(0),
    bufferAfterMinutes: z.number().int().min(0).max(120).default(0),
    hostId: z.string().nullable().default(null),
  })
  .refine((v) => v.endMinute > v.startMinute, { message: '結束時間必須晚於開始時間', path: ['endMinute'] })

export type ActivityInput = z.infer<typeof activityInputSchema>

function ruleOf(v: Pick<ActivityInput, 'repeatKind' | 'weekdays' | 'intervalWeeks' | 'seriesStartDate' | 'seriesEndDate' | 'occurrenceCount' | 'skipDates'>): RecurrenceRule {
  return {
    repeatKind: v.repeatKind,
    weekdays: v.weekdays,
    intervalWeeks: v.intervalWeeks,
    seriesStartDate: v.seriesStartDate,
    seriesEndDate: v.repeatKind === 'ONCE' ? null : v.seriesEndDate,
    occurrenceCount: v.repeatKind === 'ONCE' ? 1 : v.occurrenceCount,
    skipDates: v.skipDates,
  }
}

/** 單一場次的各個時間點（Asia/Taipei） */
export function sessionTimes(
  date: string,
  v: Pick<ActivityInput, 'startMinute' | 'endMinute' | 'openDaysBefore' | 'openMinute' | 'closeMinutesBefore'>,
) {
  const startAt = taipeiToUtc(date, v.startMinute)
  const endAt = taipeiToUtc(date, v.endMinute)
  const bookingOpenAt = taipeiToUtc(addDays(date, -v.openDaysBefore), v.openMinute ?? v.startMinute)
  const bookingCloseAt = new Date(startAt.getTime() - v.closeMinutesBefore * 60_000)
  return { startAt, endAt, bookingOpenAt, bookingCloseAt }
}

async function primaryVenue() {
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!venue) throw new ActivityAdminError('尚未設定場館')
  return venue
}

/* ─────────────────────────── 預覽 ─────────────────────────── */

export type PreviewRowStatus = 'NEW' | 'EXISTS' | 'CONFLICT' | 'PAST' | 'INVALID'

export interface PreviewRow {
  date: string
  dateLabel: string
  timeLabel: string
  courtNames: string[]
  /** 含準備／清場緩衝的實際占用時段 */
  occupyLabel: string
  opensAt: string
  closesAt: string
  status: PreviewRowStatus
  conflicts: Conflict[]
  note: string | null
  existingSessionId: string | null
}

export interface PreviewResult {
  ok: boolean
  error: string | null
  rows: PreviewRow[]
  skipped: string[]
  counts: { new: number; exists: number; conflict: number; past: number }
}

/** 依輸入列出將建立的場次與衝突（不寫入任何資料） */
export async function previewActivity(raw: unknown, activityId?: string | null): Promise<PreviewResult> {
  const empty = (error: string): PreviewResult => ({
    ok: false,
    error,
    rows: [],
    skipped: [],
    counts: { new: 0, exists: 0, conflict: 0, past: 0 },
  })
  const parsed = activityInputSchema.safeParse(raw)
  if (!parsed.success) return empty(parsed.error.errors[0]?.message ?? '輸入資料有誤')
  const v = parsed.data

  const venue = await primaryVenue()
  const rangeError = validateRange(venue, v.startMinute, v.endMinute)
  if (rangeError) return empty(rangeError)
  const courts = venue.courts.filter((c) => v.courtIds.includes(c.id))
  if (courts.length !== v.courtIds.length) return empty('場地資料有誤，請重新選擇')
  const inactive = courts.filter((c) => !c.active)
  if (inactive.length > 0) return empty(`${inactive.map((c) => c.name).join('、')} 目前停用或維護中`)
  if (v.hostId) {
    const host = await prisma.host.findFirst({ where: { id: v.hostId, venueId: venue.id, active: true }, select: { id: true } })
    if (!host) return empty('主持人資料有誤，請重新選擇')
  }
  const occ = withBuffer(venue, v.startMinute, v.endMinute, v.bufferBeforeMinutes, v.bufferAfterMinutes)

  const plan = planOccurrences(ruleOf(v))
  if (plan.error) return empty(plan.error)

  const existing = activityId
    ? await prisma.session.findMany({
        where: { activityId, deletedAt: null },
        select: { id: true, startAt: true, status: true },
      })
    : []
  const existingByDate = new Map(existing.map((s) => [taipeiDateString(s.startAt), s]))

  const conflicts = await findConflicts({
    venue,
    courts,
    ranges: plan.dates.map((d) => ({ date: d, startMinute: occ.startMinute, endMinute: occ.endMinute })),
    excludeSessionIds: existing.map((s) => s.id),
  })

  const at = now()
  const rows: PreviewRow[] = plan.dates.map((d) => {
    const t = sessionTimes(d, v)
    const ex = existingByDate.get(d)
    const c = conflicts.get(d) ?? []
    let status: PreviewRowStatus = 'NEW'
    let note: string | null = null
    if (ex && ex.status !== SessionStatus.DRAFT) {
      status = 'EXISTS'
      note = ex.status === SessionStatus.CANCELLED ? '已建立（已取消）' : '已建立，修改請用場次列表的「修改」'
    } else if (t.startAt <= at) {
      status = 'PAST'
      note = '時間已過，不會建立'
    } else if (t.bookingOpenAt >= t.bookingCloseAt) {
      status = 'INVALID'
      note = '報名開放時間晚於截止時間，請調整「開放報名」設定'
    } else if (c.length > 0) {
      status = 'CONFLICT'
    }
    return {
      date: d,
      dateLabel: shortDateLabel(d),
      timeLabel: activityTimeLabel(v.startMinute, v.endMinute),
      courtNames: courts.map((x) => x.name),
      occupyLabel: activityTimeLabel(occ.startMinute, occ.endMinute),
      opensAt: formatDateTime(t.bookingOpenAt),
      closesAt: formatDateTime(t.bookingCloseAt),
      status,
      conflicts: status === 'CONFLICT' ? c : [],
      note,
      existingSessionId: ex?.id ?? null,
    }
  })

  const invalid = rows.find((r) => r.status === 'INVALID')
  return {
    ok: !invalid,
    error: invalid ? invalid.note : null,
    rows,
    skipped: plan.skipped,
    counts: {
      new: rows.filter((r) => r.status === 'NEW').length,
      exists: rows.filter((r) => r.status === 'EXISTS').length,
      conflict: rows.filter((r) => r.status === 'CONFLICT').length,
      past: rows.filter((r) => r.status === 'PAST').length,
    },
  }
}

/* ─────────────────────────── 儲存與發布 ─────────────────────────── */

function activityData(v: ActivityInput) {
  return {
    title: v.title,
    type: v.type,
    summary: v.summary || null,
    description: v.description || null,
    levelLabel: v.levelLabel || null,
    requirements: v.requirements || null,
    includes: v.includes || null,
    refundNote: v.refundNote || null,
    coverAssetId: v.coverAssetId,
    coverFocusX: v.coverFocusX,
    coverFocusY: v.coverFocusY,
    price: v.price,
    priceUnit: v.priceUnit,
    capacity: v.capacity,
    maxPerOrder: v.maxPerOrder,
    repeatKind: v.repeatKind,
    weekdays: v.weekdays.join(','),
    intervalWeeks: v.intervalWeeks,
    startMinute: v.startMinute,
    endMinute: v.endMinute,
    seriesStartDate: v.seriesStartDate,
    seriesEndDate: v.repeatKind === 'ONCE' ? null : v.seriesEndDate,
    occurrenceCount: v.repeatKind === 'ONCE' ? 1 : v.occurrenceCount,
    skipDates: [...new Set(v.skipDates)].sort().join(','),
    courtIds: v.courtIds.join(','),
    openDaysBefore: v.openDaysBefore,
    openMinute: v.openMinute,
    closeMinutesBefore: v.closeMinutesBefore,
    visibility: v.visibility,
    customTypeLabel: v.type === 'OTHER' ? v.customTypeLabel || null : null,
    locationNote: v.locationNote || null,
    bufferBeforeMinutes: v.bufferBeforeMinutes,
    bufferAfterMinutes: v.bufferAfterMinutes,
    hostId: v.hostId,
  }
}

export interface SaveResult {
  activityId: string
  created: { date: string; sessionId: string }[]
  failed: { date: string; reason: string }[]
  excluded: string[]
  message: string
}

/**
 * 儲存活動。
 * mode = 'draft'   ：只存資料；holdDays > 0 時建立草稿場次並「保留場地」到期自動釋放。
 * mode = 'publish' ：依預覽建立場次與佔用。衝突日期必須在 excludeDates 中明確排除（會記入跳過日期），否則不發布。
 */
export async function saveActivity(params: {
  id?: string | null
  input: unknown
  mode: 'draft' | 'publish'
  excludeDates?: string[]
  holdDays?: number
  actor: string
}): Promise<SaveResult> {
  const parsed = activityInputSchema.safeParse(params.input)
  if (!parsed.success) throw new ActivityAdminError(parsed.error.errors[0]?.message ?? '輸入資料有誤')
  let v = parsed.data
  const venue = await primaryVenue()

  const current = params.id
    ? await prisma.activity.findFirst({ where: { id: params.id, deletedAt: null } })
    : null
  if (params.id && !current) throw new ActivityAdminError('找不到這個活動')
  const wasPublished = current?.status === 'PUBLISHED'

  // 明確排除的衝突日期寫入「跳過日期」，系列紀錄可追溯
  const excluded = [...new Set(params.excludeDates ?? [])]
  if (excluded.length > 0) v = { ...v, skipDates: [...new Set([...v.skipDates, ...excluded])] }

  const preview = await previewActivity(v, current?.id)
  if (!preview.ok) throw new ActivityAdminError(preview.error ?? '場次設定有誤')

  if (params.mode === 'publish') {
    const stillConflict = preview.rows.filter((r) => r.status === 'CONFLICT')
    if (stillConflict.length > 0) {
      throw new ActivityAdminError(
        `${stillConflict.map((r) => r.dateLabel).join('、')} 有場地衝突，請改時段、換場地或勾選排除這些日期後再發布`,
      )
    }
    if (!wasPublished && preview.counts.new === 0 && preview.counts.exists === 0) {
      throw new ActivityAdminError('沒有可建立的場次，請檢查日期設定')
    }
  }

  const base = activityData(v)
  const activity = current
    ? await prisma.activity.update({
        where: { id: current.id },
        data: {
          ...base,
          status: params.mode === 'publish' ? 'PUBLISHED' : current.status,
          holdUntil: params.mode === 'draft' && params.holdDays ? new Date(now().getTime() + params.holdDays * 86_400_000) : null,
        },
      })
    : await prisma.activity.create({
        data: {
          ...base,
          organizationId: venue.organizationId,
          venueId: venue.id,
          status: params.mode === 'publish' ? 'PUBLISHED' : 'DRAFT',
          holdUntil: params.mode === 'draft' && params.holdDays ? new Date(now().getTime() + params.holdDays * 86_400_000) : null,
        },
      })

  // 更換封面：舊圖沒有其他活動或場次使用時才刪除
  if (current?.coverAssetId && current.coverAssetId !== v.coverAssetId) await deleteAssetIfUnused(current.coverAssetId)

  // 已發布活動修改基本資料：同步到尚未結束的場次（標題、介紹沿用活動者）；價格、名額、時間、場地請用場次修改
  if (current && wasPublished) {
    await prisma.session.updateMany({
      where: { activityId: activity.id, title: current.title, endAt: { gt: now() }, status: { not: SessionStatus.CANCELLED } },
      data: { title: v.title },
    })
  }

  const created: SaveResult['created'] = []
  const failed: SaveResult['failed'] = []

  const isDraftHold = params.mode === 'draft' && (params.holdDays ?? 0) > 0
  if (params.mode === 'publish' || isDraftHold) {
    const holdUntil = isDraftHold ? activity.holdUntil : null
    const courts = venue.courts.filter((c) => v.courtIds.includes(c.id))
    const existing = await prisma.session.findMany({ where: { activityId: activity.id, deletedAt: null } })
    const byDate = new Map(existing.map((s) => [taipeiDateString(s.startAt), s]))
    let index = existing.length

    for (const row of preview.rows) {
      if (row.status !== 'NEW') continue
      const t = sessionTimes(row.date, v)
      const draft = byDate.get(row.date)
      try {
        const id = await prisma.$transaction(async (tx) => {
          const status = isDraftHold
            ? SessionStatus.DRAFT
            : t.bookingOpenAt <= now()
              ? SessionStatus.OPEN
              : SessionStatus.SCHEDULED
          const data = {
            title: v.title,
            description: null,
            startAt: t.startAt,
            endAt: t.endAt,
            bookingOpenAt: t.bookingOpenAt,
            bookingCloseAt: t.bookingCloseAt,
            cancelDeadline: t.bookingCloseAt,
            finalizeAt: t.bookingCloseAt,
            capacity: v.capacity,
            reservedCapacity: 0,
            price: v.price,
            waitlistEnabled: false,
            autoPromote: false,
            status,
            courtId: courts[0]?.id ?? null,
            bufferBeforeMinutes: v.bufferBeforeMinutes,
            bufferAfterMinutes: v.bufferAfterMinutes,
          }
          let sessionId: string
          if (draft) {
            // 草稿場次轉正式：清除舊的保留後重新佔用
            await releaseOccupancy(tx, draft.id)
            await tx.sessionCourt.deleteMany({ where: { sessionId: draft.id } })
            await tx.session.update({ where: { id: draft.id }, data })
            sessionId = draft.id
          } else {
            const s = await tx.session.create({
              data: {
                ...data,
                organizationId: venue.organizationId,
                venueId: venue.id,
                activityId: activity.id,
                seriesIndex: ++index,
              },
            })
            sessionId = s.id
          }
          await tx.sessionCourt.createMany({ data: courts.map((c) => ({ sessionId, courtId: c.id })) })
          const occ = withBuffer(venue, v.startMinute, v.endMinute, v.bufferBeforeMinutes, v.bufferAfterMinutes)
          await occupyCourts(tx, {
            sessionId,
            venue,
            courtIds: courts.map((c) => c.id),
            date: row.date,
            startMinute: occ.startMinute,
            endMinute: occ.endMinute,
            holdExpiresAt: holdUntil,
          })
          return sessionId
        }, TX_OPTIONS)
        created.push({ date: row.date, sessionId: id })
      } catch (err) {
        failed.push({
          date: row.date,
          reason: err instanceof OccupancyConflictError ? '預覽後場地被占用，未建立' : '建立失敗，請重試',
        })
        if (!(err instanceof OccupancyConflictError)) console.error('[activity] 建立場次失敗', err)
      }
    }

    // 發布時，已存在的草稿保留場次一起轉正（清掉到期時間）
    if (params.mode === 'publish') {
      const drafts = existing.filter((s) => s.status === SessionStatus.DRAFT && !created.some((c) => c.sessionId === s.id))
      for (const d of drafts) {
        const opensNow = d.bookingOpenAt <= now()
        await prisma.$transaction(async (tx) => {
          await tx.session.update({ where: { id: d.id }, data: { status: opensNow ? SessionStatus.OPEN : SessionStatus.SCHEDULED } })
          await tx.reservation.updateMany({ where: { sessionId: d.id, status: 'EVENT' }, data: { holdExpiresAt: null } })
        })
      }
      await prisma.activity.update({ where: { id: activity.id }, data: { holdUntil: null } })
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: params.actor,
      action: params.mode === 'publish' ? 'ACTIVITY_PUBLISH' : 'ACTIVITY_SAVE',
      target: activity.title,
      detail: {
        activityId: activity.id,
        created: created.length,
        failed: failed.map((f) => `${f.date} ${f.reason}`),
        excluded,
        holdDays: params.holdDays ?? 0,
      },
    },
  })

  const parts = [
    params.mode === 'publish' ? '已發布' : isDraftHold ? `已存草稿並保留場地 ${params.holdDays} 天` : '已存草稿',
    created.length > 0 ? `建立 ${created.length} 場` : '',
    excluded.length > 0 ? `排除 ${excluded.length} 個衝突日期` : '',
    failed.length > 0 ? `${failed.length} 場未建立（見下方說明）` : '',
  ].filter(Boolean)

  return { activityId: activity.id, created, failed, excluded, message: parts.join('，') }
}

/* ─────────────────────────── 場次修改（本場／本場及後續／整個系列） ─────────────────────────── */

export const sessionEditSchema = z.object({
  sessionId: z.string(),
  scope: z.enum(['ONE', 'FOLLOWING', 'ALL']),
  changes: z.object({
    title: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    price: z.number().int().min(0).max(100_000).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    startMinute: z.number().int().min(0).max(2880).optional(),
    endMinute: z.number().int().min(0).max(2880).optional(),
    courtIds: z.array(z.string()).min(1).optional(),
    bufferBeforeMinutes: z.number().int().min(0).max(120).optional(),
    bufferAfterMinutes: z.number().int().min(0).max(120).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    coverAssetId: z.string().nullable().optional(),
    coverFocusX: z.number().int().min(0).max(100).nullable().optional(),
    coverFocusY: z.number().int().min(0).max(100).nullable().optional(),
  }),
})

export type SessionEditInput = z.infer<typeof sessionEditSchema>

export interface EditImpactRow {
  sessionId: string
  dateLabel: string
  timeLabel: string
  ok: boolean
  problems: string[]
  conflicts: Conflict[]
  affected: { name: string; quantity: number; status: string }[]
}

async function editTargets(sessionId: string, scope: SessionEditInput['scope']) {
  const s = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!s) throw new ActivityAdminError('找不到這場活動')
  const editable: Prisma.SessionWhereInput = {
    deletedAt: null,
    status: { notIn: [SessionStatus.CANCELLED, SessionStatus.COMPLETED] },
    endAt: { gt: now() },
  }
  if (scope === 'ONE' || !s.activityId) {
    return prisma.session.findMany({ where: { id: s.id, ...editable }, include: { courts: true } })
  }
  return prisma.session.findMany({
    where: { activityId: s.activityId, ...editable, ...(scope === 'FOLLOWING' ? { startAt: { gte: s.startAt } } : {}) },
    include: { courts: true },
    orderBy: { startAt: 'asc' },
  })
}

/** 預覽修改的影響：哪些場次可套用、衝突、受影響的已報名者 */
export async function previewSessionEdit(raw: unknown): Promise<EditImpactRow[]> {
  const input = sessionEditSchema.parse(raw)
  const venue = await primaryVenue()
  const targets = await editTargets(input.sessionId, input.scope)
  if (targets.length === 0) throw new ActivityAdminError('沒有可修改的場次（已結束或已取消的場次保留歷史，不能修改）')
  const c = input.changes
  const used = await seatsUsed(targets.map((t) => t.id))
  const regs = await prisma.sessionRegistration.findMany({
    where: {
      sessionId: { in: targets.map((t) => t.id) },
      OR: [
        { status: RegistrationStatus.CONFIRMED },
        { status: RegistrationStatus.PENDING, holdExpiresAt: { gt: now() } },
      ],
    },
    include: { user: { select: { displayName: true } } },
  })

  const rows: EditImpactRow[] = []
  for (const t of targets) {
    const date = taipeiDateString(t.startAt)
    const curStart = taipeiMinuteOfDay(t.startAt)
    const curEnd = curStart + Math.round((t.endAt.getTime() - t.startAt.getTime()) / 60_000)
    const newStart = c.startMinute ?? curStart
    const newEnd = c.endMinute ?? curEnd
    const curCourts = t.courts.map((x) => x.courtId).sort()
    const newCourts = (c.courtIds ?? curCourts).slice().sort()
    const bufB = c.bufferBeforeMinutes ?? t.bufferBeforeMinutes
    const bufA = c.bufferAfterMinutes ?? t.bufferAfterMinutes
    const timeChanged = newStart !== curStart || newEnd !== curEnd || bufB !== t.bufferBeforeMinutes || bufA !== t.bufferAfterMinutes
    const courtsChanged = newCourts.join(',') !== curCourts.join(',')
    // 舊場次第一次補填場地：報名者的時間與場館都沒變，不視為異動
    const firstAssign = courtsChanged && curCourts.length === 0 && !timeChanged
    const problems: string[] = []

    if (timeChanged) {
      const err = validateRange(venue, newStart, newEnd)
      if (err) problems.push(err)
      if (taipeiToUtc(date, newStart) <= now()) problems.push('新的開始時間已過')
    }
    if (c.capacity !== undefined && c.capacity - t.reservedCapacity < (used.get(t.id) ?? 0)) {
      problems.push(`名額不能少於已報名＋暫留的 ${used.get(t.id) ?? 0} 位`)
    }
    let conflicts: Conflict[] = []
    if ((timeChanged || courtsChanged) && problems.length === 0) {
      const courts = venue.courts.filter((x) => newCourts.includes(x.id))
      const occ = withBuffer(venue, newStart, newEnd, bufB, bufA)
      const m = await findConflicts({
        venue,
        courts,
        ranges: [{ date, startMinute: occ.startMinute, endMinute: occ.endMinute }],
        excludeSessionIds: [t.id],
      })
      conflicts = m.get(date) ?? []
    }
    const affected =
      (timeChanged || courtsChanged) && !firstAssign
        ? regs
            .filter((r) => r.sessionId === t.id)
            .map((r) => ({
              name: r.user.displayName,
              quantity: r.quantity,
              status: r.status === RegistrationStatus.CONFIRMED ? '已報名' : r.bookingId ? '待付款' : '購物車暫留',
            }))
        : []
    rows.push({
      sessionId: t.id,
      dateLabel: shortDateLabel(date),
      timeLabel: activityTimeLabel(newStart, newEnd),
      ok: problems.length === 0 && conflicts.length === 0,
      problems,
      conflicts,
      affected,
    })
  }
  return rows
}

/**
 * 套用修改。只套用預覽可行的場次；有已報名者受影響時必須 confirmAffected。
 * 時間、場地異動：重新佔用場地（失敗則該場不變）、更新訂單明細的時間與場地、通知已報名者。
 * 價格異動只影響之後的新訂單，已成立訂單的金額不變。
 */
export async function applySessionEdit(raw: unknown, opts: { confirmAffected: boolean; actor: string }) {
  const input = sessionEditSchema.parse(raw)
  const rows = await previewSessionEdit(input)
  const needConfirm = rows.some((r) => r.ok && r.affected.length > 0)
  if (needConfirm && !opts.confirmAffected) {
    throw new ActivityAdminError('這次修改會影響已報名的會員，請先確認影響名單')
  }
  const venue = await primaryVenue()
  const c = input.changes
  const applied: string[] = []
  const oldCovers = new Set<string>()
  const skipped: { sessionId: string; reason: string }[] = rows
    .filter((r) => !r.ok)
    .map((r) => ({ sessionId: r.sessionId, reason: [...r.problems, ...r.conflicts.map((x) => `${x.courtName} ${x.reason}`)].join('；') }))

  for (const row of rows.filter((r) => r.ok)) {
    const t = await prisma.session.findUniqueOrThrow({ where: { id: row.sessionId }, include: { courts: true, activity: true } })
    if (c.coverAssetId !== undefined && t.coverAssetId) oldCovers.add(t.coverAssetId)
    const date = taipeiDateString(t.startAt)
    const curStart = taipeiMinuteOfDay(t.startAt)
    const curEnd = curStart + Math.round((t.endAt.getTime() - t.startAt.getTime()) / 60_000)
    const newStart = c.startMinute ?? curStart
    const newEnd = c.endMinute ?? curEnd
    const newCourts = c.courtIds ?? t.courts.map((x) => x.courtId)
    const bufB = c.bufferBeforeMinutes ?? t.bufferBeforeMinutes
    const bufA = c.bufferAfterMinutes ?? t.bufferAfterMinutes
    const timeChanged = newStart !== curStart || newEnd !== curEnd || bufB !== t.bufferBeforeMinutes || bufA !== t.bufferAfterMinutes
    const courtsChanged = newCourts.slice().sort().join(',') !== t.courts.map((x) => x.courtId).sort().join(',')

    try {
      await prisma.$transaction(async (tx) => {
        const data: Prisma.SessionUpdateInput = {}
        if (c.title !== undefined) data.title = c.title
        if (c.description !== undefined) data.description = c.description || null
        if (c.price !== undefined) data.price = c.price
        if (c.capacity !== undefined) data.capacity = c.capacity
        if (c.coverAssetId !== undefined) data.coverAsset = c.coverAssetId ? { connect: { id: c.coverAssetId } } : { disconnect: true }
        if (c.coverFocusX !== undefined) data.coverFocusX = c.coverFocusX
        if (c.coverFocusY !== undefined) data.coverFocusY = c.coverFocusY
        if (c.note !== undefined) data.note = c.note || null
        if (c.bufferBeforeMinutes !== undefined) data.bufferBeforeMinutes = c.bufferBeforeMinutes
        if (c.bufferAfterMinutes !== undefined) data.bufferAfterMinutes = c.bufferAfterMinutes

        if (timeChanged) {
          const a = t.activity
          const times = sessionTimes(date, {
            startMinute: newStart,
            endMinute: newEnd,
            openDaysBefore: a?.openDaysBefore ?? 7,
            openMinute: a?.openMinute ?? null,
            closeMinutesBefore: a?.closeMinutesBefore ?? 60,
          })
          data.startAt = times.startAt
          data.endAt = times.endAt
          data.bookingCloseAt = times.bookingCloseAt
          data.cancelDeadline = times.bookingCloseAt
          data.finalizeAt = times.bookingCloseAt
          // 已開放報名的場次不把開放時間往後延，避免已在報名的人突然被擋
          if (t.bookingOpenAt > now()) data.bookingOpenAt = times.bookingOpenAt
        }
        if (courtsChanged) data.court = { connect: { id: newCourts[0] } }
        await tx.session.update({ where: { id: t.id }, data })

        if (timeChanged || courtsChanged) {
          await releaseOccupancy(tx, t.id)
          if (courtsChanged) {
            await tx.sessionCourt.deleteMany({ where: { sessionId: t.id } })
            await tx.sessionCourt.createMany({ data: newCourts.map((courtId) => ({ sessionId: t.id, courtId })) })
          }
          if (t.status !== SessionStatus.DRAFT || (await tx.reservation.count({ where: { sessionId: t.id } })) === 0) {
            const occ = withBuffer(venue, newStart, newEnd, bufB, bufA)
            await occupyCourts(tx, { sessionId: t.id, venue, courtIds: newCourts, date, startMinute: occ.startMinute, endMinute: occ.endMinute })
          }
          const names = venue.courts.filter((x) => newCourts.includes(x.id)).map((x) => x.name).join('、')
          await tx.bookingActivityItem.updateMany({
            where: { sessionId: t.id, status: 'ACTIVE' },
            data: {
              startsAt: taipeiToUtc(date, newStart),
              endsAt: taipeiToUtc(date, newEnd),
              courtNames: names,
            },
          })
        }
      }, TX_OPTIONS)
      applied.push(t.id)

      if ((timeChanged || courtsChanged) && row.affected.length > 0) {
        await notifyRegistrants(t.id, 'SESSION_CHANGED', (title) =>
          `「${title}」場次異動：${shortDateLabel(date)} ${activityTimeLabel(newStart, newEnd)}，場地：${venue.courts
            .filter((x) => newCourts.includes(x.id))
            .map((x) => x.name)
            .join('、')}。如無法參加，可於「我的預約」取消或聯絡場館。`,
        )
      }
      if (c.capacity !== undefined) await notifySeatWatchers([t.id]).catch(() => {})
    } catch (err) {
      skipped.push({
        sessionId: t.id,
        reason: err instanceof OccupancyConflictError ? '預覽後場地被占用，未修改' : '修改失敗，請重試',
      })
      if (!(err instanceof OccupancyConflictError)) console.error('[activity] 修改場次失敗', err)
    }
  }

  for (const id of oldCovers) await deleteAssetIfUnused(id)

  await prisma.auditLog.create({
    data: {
      actor: opts.actor,
      action: 'ACTIVITY_SESSION_EDIT',
      target: input.sessionId,
      detail: { scope: input.scope, changes: input.changes as Prisma.InputJsonValue, applied: applied.length, skipped } as Prisma.InputJsonValue,
    },
  })
  return { applied, skipped }
}

/* ─────────────────────────── 取消場次 ─────────────────────────── */

/**
 * 取消場次：釋放場地佔用、清掉購物車暫留，已付款報名全額退款（原路退款失敗時改退點數），
 * 待付款訂單整張取消，並通知所有報名者。不刪除場次，歷史保留。
 */
export async function cancelActivitySession(sessionId: string, reason: string, actor: string) {
  const s = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!s) throw new ActivityAdminError('找不到這場活動')
  if (s.status === SessionStatus.CANCELLED) throw new ActivityAdminError('這場已經取消了')
  if (s.endAt <= now()) throw new ActivityAdminError('已結束的場次不能取消')

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.CANCELLED, cancelReason: reason.trim() || '場館取消' },
    })
    await releaseOccupancy(tx, sessionId)
    // 購物車暫留：直接失效（之後結帳會被擋下）
    await tx.sessionRegistration.updateMany({
      where: { sessionId, status: RegistrationStatus.PENDING, bookingId: null },
      data: { status: RegistrationStatus.EXPIRED, holdExpiresAt: null, cartToken: null },
    })
    await tx.sessionWatch.updateMany({ where: { sessionId, cancelledAt: null }, data: { cancelledAt: now() } })
  }, TX_OPTIONS)

  const summary = { refunded: 0, refundedAmount: 0, toPoints: 0, pendingCancelled: 0, freeCancelled: 0 }

  // 待付款訂單：整張取消（含同訂單的其他項目，點數與折價券歸還）
  const pendingBookings = await prisma.booking.findMany({
    where: { status: 'PENDING', activityItems: { some: { sessionId, status: 'ACTIVE' } } },
    select: { id: true },
  })
  for (const b of pendingBookings) {
    await cancelBooking(b.id, actor, { asAdmin: true, fullRefund: true }).catch((err) => console.error('[activity] 取消待付款訂單失敗', err))
    summary.pendingCancelled++
  }

  // 已付款報名：只退這場的金額
  const paidItems = await prisma.bookingActivityItem.findMany({
    where: { sessionId, status: 'ACTIVE', booking: { status: 'PAID' } },
    include: { booking: { include: { payments: true, items: true, activityItems: true } } },
  })
  for (const item of paidItems) {
    const b = item.booking
    // 依實付比例退款（折價券、點數折抵後的金額）
    const ratio = b.subtotal > 0 ? item.amount / b.subtotal : 0
    const cashShare = Math.round(b.total * ratio)
    const pointShare = Math.round(b.pointsUsed * ratio)
    let refundedByProvider = false
    const pay = b.payments.find((p) => p.status === 'SUCCESS' && p.providerRef && p.provider !== 'internal')
    if (pay && cashShare > 0) {
      const provider = getPaymentProvider(pay.provider)
      if (provider.refund) {
        try {
          refundedByProvider = (await provider.refund(pay.providerRef as string, cashShare)).ok
        } catch (err) {
          console.error('[activity] 原路退款失敗，改退點數', err)
        }
      }
    }
    const toPoints = (refundedByProvider ? 0 : cashShare) + pointShare
    const remainingActive = b.items.length + b.activityItems.filter((x) => x.status === 'ACTIVE' && x.id !== item.id).length
    await prisma.$transaction(async (tx) => {
      await tx.bookingActivityItem.update({ where: { id: item.id }, data: { status: 'REFUNDED' } })
      await tx.sessionRegistration.updateMany({
        where: { id: item.registrationId },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now() },
      })
      if (toPoints > 0) await tx.user.update({ where: { id: b.userId }, data: { points: { increment: toPoints } } })
      if (remainingActive === 0) await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: now() } })
      await tx.auditLog.create({
        data: {
          actor,
          action: 'ACTIVITY_REFUND',
          target: b.code,
          detail: { sessionId, amount: item.amount, cashShare, refundedByProvider, toPoints },
        },
      })
    }, TX_OPTIONS)
    summary.refunded++
    summary.refundedAmount += cashShare
    summary.toPoints += toPoints
  }

  // 沒有訂單的正取（舊版免費報名、主辦手動加入）
  const free = await prisma.sessionRegistration.updateMany({
    where: { sessionId, status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] }, bookingId: null },
    data: { status: RegistrationStatus.CANCELLED, cancelledAt: now() },
  })
  summary.freeCancelled = free.count

  await notifyRegistrants(sessionId, 'SESSION_CANCELLED', (title) =>
    `很抱歉，「${title}」${shortDateLabel(taipeiDateString(s.startAt))} 的場次已取消${reason.trim() ? `（${reason.trim()}）` : ''}。已付款的費用將全額退款，詳情請見「我的預約」。`,
  )

  await prisma.auditLog.create({
    data: { actor, action: 'ACTIVITY_SESSION_CANCEL', target: s.title, detail: { sessionId, reason, ...summary } },
  })
  return summary
}

/** 通知某場次的報名者（含已取消者以外的所有人），以 NotificationLog 去重並嘗試 LINE 推播 */
async function notifyRegistrants(
  sessionId: string,
  type: 'SESSION_CHANGED' | 'SESSION_CANCELLED',
  text: (title: string) => string,
) {
  const s = await prisma.session.findUnique({ where: { id: sessionId }, select: { title: true, updatedAt: true } })
  if (!s) return
  const regs = await prisma.sessionRegistration.findMany({
    where: {
      sessionId,
      OR: [
        { status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
        { status: RegistrationStatus.PENDING, bookingId: { not: null } },
        { status: RegistrationStatus.CANCELLED, cancelledAt: { gte: new Date(now().getTime() - 5 * 60_000) } },
      ],
    },
    include: { user: { select: { id: true, lineUserId: true } } },
  })
  const message = text(s.title)
  for (const r of regs) {
    const dedupeKey = `${type}:${sessionId}:${r.userId}:${s.updatedAt.getTime()}`
    try {
      const log = await prisma.notificationLog.create({
        data: { dedupeKey, type, userId: r.userId, sessionId, registrationId: r.id, payload: { text: message } },
      })
      const sent = r.user.lineUserId ? await pushMessages(r.user.lineUserId, [{ type: 'text', text: message }]) : false
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: sent ? { status: 'SENT', sentAt: now() } : { status: 'FAILED', error: r.user.lineUserId ? 'LINE 推播失敗或未設定' : '會員未綁定 LINE' },
      })
    } catch {
      // dedupeKey 重複：已通知過
    }
  }
}

/* ─────────────────────────── 既有場次補上場地佔用 ─────────────────────────── */

/**
 * 舊版球敘沒有佔用場地。找出未來、未取消、已發布、有指定場地卻沒有佔用的場次，逐場補上；
 * 遇到衝突不覆蓋既有訂單，回報給管理者處理。
 */
export async function syncLegacyOccupancy(): Promise<{ fixed: number; conflicts: { sessionId: string; label: string; reason: string }[] }> {
  const venue = await primaryVenue()
  const candidates = await prisma.session.findMany({
    where: {
      venueId: venue.id,
      deletedAt: null,
      status: { notIn: [SessionStatus.CANCELLED, SessionStatus.DRAFT, SessionStatus.COMPLETED] },
      endAt: { gt: now() },
      courts: { some: {} },
      occupancy: { none: {} },
      OR: [{ activityId: null }, { activity: { status: 'PUBLISHED' } }],
    },
    include: { courts: true },
    take: 100,
  })
  let fixed = 0
  const conflicts: { sessionId: string; label: string; reason: string }[] = []
  for (const s of candidates) {
    const date = taipeiDateString(s.startAt)
    const start = taipeiMinuteOfDay(s.startAt)
    const end = start + Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000)
    const label = `${s.title} ${shortDateLabel(date)} ${activityTimeLabel(start, end)}`
    const rangeError = validateRange(venue, start, end)
    if (rangeError) {
      conflicts.push({ sessionId: s.id, label, reason: rangeError })
      continue
    }
    try {
      const occ = withBuffer(venue, start, end, s.bufferBeforeMinutes, s.bufferAfterMinutes)
      await prisma.$transaction(
        (tx) =>
          occupyCourts(tx, { sessionId: s.id, venue, courtIds: s.courts.map((c) => c.courtId), date, startMinute: occ.startMinute, endMinute: occ.endMinute }),
        TX_OPTIONS,
      )
      fixed++
    } catch (err) {
      if (!(err instanceof OccupancyConflictError)) throw err
      const m = await findConflicts({
        venue,
        courts: venue.courts.filter((c) => s.courts.some((x) => x.courtId === c.id)),
        ranges: [{ date, startMinute: start, endMinute: end }],
        excludeSessionIds: [s.id],
      })
      conflicts.push({
        sessionId: s.id,
        label,
        reason: (m.get(date) ?? []).map((x) => `${x.courtName} ${x.reason}`).join('；') || '場地已被占用',
      })
    }
  }
  return { fixed, conflicts }
}

/* ─────────────────────────── 查詢（後台） ─────────────────────────── */

export async function listActivitiesAdmin() {
  const venue = await primaryVenue()
  const acts = await prisma.activity.findMany({
    where: { venueId: venue.id, deletedAt: null },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      host: { select: { id: true, name: true } },
      sessions: {
        where: { deletedAt: null },
        select: { id: true, startAt: true, endAt: true, status: true },
        orderBy: { startAt: 'asc' },
      },
    },
  })
  const at = now()
  return acts.map((a) => {
    const upcoming = a.sessions.filter((s) => s.endAt > at && s.status !== SessionStatus.CANCELLED)
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      repeatKind: a.repeatKind,
      weekdays: parseWeekdayList(a.weekdays),
      intervalWeeks: a.intervalWeeks,
      timeLabel: activityTimeLabel(a.startMinute, a.endMinute),
      price: a.price,
      priceUnit: a.priceUnit,
      capacity: a.capacity,
      coverAssetId: a.coverAssetId,
      visibility: a.visibility,
      customTypeLabel: a.customTypeLabel,
      hostId: a.hostId,
      hostName: a.host?.name ?? null,
      courtIds: parseIdList(a.courtIds),
      seriesStartDate: a.seriesStartDate,
      totalSessions: a.sessions.length,
      upcomingSessions: upcoming.length,
      nextDate: upcoming[0] ? shortDateLabel(taipeiDateString(upcoming[0].startAt)) : null,
      holdUntil: a.holdUntil?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }
  })
}

export async function getActivityAdmin(id: string) {
  const a = await prisma.activity.findFirst({ where: { id, deletedAt: null } })
  if (!a) return null
  const sessions = await prisma.session.findMany({
    where: { activityId: id, deletedAt: null },
    include: { courts: { include: { court: { select: { name: true, sortOrder: true } } } }, _count: { select: { occupancy: true } } },
    orderBy: { startAt: 'asc' },
  })
  const used = await seatsUsed(sessions.map((s) => s.id))
  const confirmed = await prisma.sessionRegistration.groupBy({
    by: ['sessionId'],
    where: { sessionId: { in: sessions.map((s) => s.id) }, status: RegistrationStatus.CONFIRMED },
    _sum: { seats: true },
  })
  const confirmedMap = new Map(confirmed.map((c) => [c.sessionId, c._sum.seats ?? 0]))
  const at = now()
  return {
    activity: {
      ...a,
      weekdays: parseWeekdayList(a.weekdays),
      skipDates: a.skipDates ? a.skipDates.split(',').filter(Boolean) : [],
      courtIds: parseIdList(a.courtIds),
      holdUntil: a.holdUntil?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      deletedAt: null,
    },
    sessions: sessions.map((s) => {
      const date = taipeiDateString(s.startAt)
      const start = taipeiMinuteOfDay(s.startAt)
      const end = start + Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000)
      const ended = s.endAt <= at
      return {
        id: s.id,
        date,
        dateLabel: shortDateLabel(date),
        startMinute: start,
        endMinute: end,
        timeLabel: activityTimeLabel(start, end),
        courtIds: s.courts.map((c) => c.courtId),
        courtNames: [...s.courts].sort((x, y) => x.court.sortOrder - y.court.sortOrder).map((c) => c.court.name),
        price: s.price,
        capacity: publicCapacity(s),
        used: used.get(s.id) ?? 0,
        confirmed: confirmedMap.get(s.id) ?? 0,
        status: s.status,
        ended,
        editable: !ended && s.status !== SessionStatus.CANCELLED,
        occupied: s._count.occupancy > 0,
        overriddenCover: Boolean(s.coverAssetId),
        description: s.description,
        title: s.title,
        coverAssetId: s.coverAssetId,
        coverFocusX: s.coverFocusX,
        coverFocusY: s.coverFocusY,
        opensAt: formatDateTime(s.bookingOpenAt),
        cancelReason: s.cancelReason,
        note: s.note,
        bufferBeforeMinutes: s.bufferBeforeMinutes,
        bufferAfterMinutes: s.bufferAfterMinutes,
        registrations: used.get(s.id) ?? 0,
      }
    }),
  }
}

/** 下架活動：未來沒有報名的場次一併取消並釋放場地；有報名的場次需先逐場取消（含退款） */
export async function archiveActivity(id: string, actor: string) {
  const a = await prisma.activity.findFirst({ where: { id, deletedAt: null } })
  if (!a) throw new ActivityAdminError('找不到這個活動')
  const future = await prisma.session.findMany({
    where: { activityId: id, deletedAt: null, endAt: { gt: now() }, status: { not: SessionStatus.CANCELLED } },
    select: { id: true, title: true, startAt: true },
  })
  const used = await seatsUsed(future.map((s) => s.id))
  const busy = future.filter((s) => (used.get(s.id) ?? 0) > 0)
  if (busy.length > 0) {
    throw new ActivityAdminError(
      `${busy.map((s) => shortDateLabel(taipeiDateString(s.startAt))).join('、')} 已有報名，請先在場次列表逐場取消（會辦理退款與通知）`,
    )
  }
  await prisma.$transaction(async (tx) => {
    for (const s of future) {
      await tx.session.update({ where: { id: s.id }, data: { status: SessionStatus.CANCELLED, cancelReason: '活動下架' } })
      await releaseOccupancy(tx, s.id)
    }
    await tx.activity.update({ where: { id }, data: { status: a.status === 'DRAFT' ? 'DRAFT' : 'ARCHIVED', deletedAt: a.status === 'DRAFT' ? now() : null, holdUntil: null } })
    await tx.auditLog.create({ data: { actor, action: 'ACTIVITY_ARCHIVE', target: a.title, detail: { activityId: id, cancelled: future.length } } })
  }, TX_OPTIONS)
  return { cancelled: future.length }
}

/* ─────────────────────────── 新增單場／複製場次／移除未發布場次 ─────────────────────────── */

export const addSessionSchema = z.object({
  activityId: z.string(),
  date: dateStr,
  startMinute: z.number().int().min(0).max(2880),
  endMinute: z.number().int().min(0).max(2880),
  courtIds: z.array(z.string()).min(1, '請至少選擇一面場地'),
  bufferBeforeMinutes: z.number().int().min(0).max(120).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(120).default(0),
  note: z.string().trim().max(500).nullable().default(null),
  price: z.number().int().min(0).max(100_000).nullable().default(null),
  capacity: z.number().int().min(1).max(500).nullable().default(null),
})
export type AddSessionInput = z.infer<typeof addSessionSchema>

/** 預覽新增一場的衝突（不寫入） */
export async function previewAddSession(raw: unknown): Promise<{ ok: boolean; problems: string[]; conflicts: Conflict[]; occupyLabel: string }> {
  const v = addSessionSchema.parse(raw)
  const venue = await primaryVenue()
  const a = await prisma.activity.findFirst({ where: { id: v.activityId, deletedAt: null } })
  if (!a) throw new ActivityAdminError('找不到這個活動')
  const problems: string[] = []
  const rangeError = validateRange(venue, v.startMinute, v.endMinute)
  if (rangeError) problems.push(rangeError)
  const courts = venue.courts.filter((c) => v.courtIds.includes(c.id))
  if (courts.length !== v.courtIds.length) problems.push('場地資料有誤')
  if (courts.some((c) => !c.active)) problems.push('有場地停用或維護中')
  if (taipeiToUtc(v.date, v.startMinute) <= now()) problems.push('開始時間已過')
  const occ = withBuffer(venue, v.startMinute, v.endMinute, v.bufferBeforeMinutes, v.bufferAfterMinutes)
  const conflicts = problems.length === 0 ? ((await findConflicts({ venue, courts, ranges: [{ date: v.date, ...occ }] })).get(v.date) ?? []) : []
  return { ok: problems.length === 0 && conflicts.length === 0, problems, conflicts, occupyLabel: activityTimeLabel(occ.startMinute, occ.endMinute) }
}

/** 在既有活動下新增一場（可用於複製場次）；草稿活動建立草稿場次（不占用），已發布活動直接占用 */
export async function addSession(raw: unknown, actor: string): Promise<{ sessionId: string }> {
  const v = addSessionSchema.parse(raw)
  const pv = await previewAddSession(v)
  if (!pv.ok) throw new ActivityAdminError([...pv.problems, ...pv.conflicts.map((c) => `${c.courtName} ${activityTimeLabel(c.startMinute, c.endMinute)} ${c.reason}`)].join('；'))
  const venue = await primaryVenue()
  const a = await prisma.activity.findFirstOrThrow({ where: { id: v.activityId, deletedAt: null } })
  const t = sessionTimes(v.date, { startMinute: v.startMinute, endMinute: v.endMinute, openDaysBefore: a.openDaysBefore, openMinute: a.openMinute, closeMinutesBefore: a.closeMinutesBefore })
  if (t.bookingOpenAt >= t.bookingCloseAt) throw new ActivityAdminError('報名開放時間晚於截止時間，請調整活動的開放設定')
  const published = a.status === 'PUBLISHED'
  const count = await prisma.session.count({ where: { activityId: a.id } })
  const occ = withBuffer(venue, v.startMinute, v.endMinute, v.bufferBeforeMinutes, v.bufferAfterMinutes)
  try {
    const id = await prisma.$transaction(async (tx) => {
      const s = await tx.session.create({
        data: {
          organizationId: venue.organizationId,
          venueId: venue.id,
          activityId: a.id,
          seriesIndex: count + 1,
          title: a.title,
          description: null,
          startAt: t.startAt,
          endAt: t.endAt,
          bookingOpenAt: t.bookingOpenAt,
          bookingCloseAt: t.bookingCloseAt,
          cancelDeadline: t.bookingCloseAt,
          finalizeAt: t.bookingCloseAt,
          capacity: v.capacity ?? a.capacity,
          reservedCapacity: 0,
          price: v.price ?? a.price,
          waitlistEnabled: false,
          autoPromote: false,
          status: !published ? SessionStatus.DRAFT : t.bookingOpenAt <= now() ? SessionStatus.OPEN : SessionStatus.SCHEDULED,
          courtId: v.courtIds[0],
          bufferBeforeMinutes: v.bufferBeforeMinutes,
          bufferAfterMinutes: v.bufferAfterMinutes,
          note: v.note,
        },
      })
      await tx.sessionCourt.createMany({ data: v.courtIds.map((courtId) => ({ sessionId: s.id, courtId })) })
      if (published) await occupyCourts(tx, { sessionId: s.id, venue, courtIds: v.courtIds, date: v.date, startMinute: occ.startMinute, endMinute: occ.endMinute })
      return s.id
    }, TX_OPTIONS)
    await prisma.auditLog.create({ data: { actor, action: 'ACTIVITY_SESSION_ADD', target: a.title, detail: { sessionId: id, date: v.date, courtIds: v.courtIds, published } } })
    return { sessionId: id }
  } catch (err) {
    if (err instanceof OccupancyConflictError) throw new ActivityAdminError('預覽後場地被占用，未建立')
    throw err
  }
}

/** 移除未發布（草稿）且沒有報名的場次；已發布場次請用「取消」 */
export async function removeDraftSession(sessionId: string, actor: string): Promise<void> {
  const s = await prisma.session.findUnique({ where: { id: sessionId }, include: { activity: { select: { title: true, status: true } } } })
  if (!s || s.deletedAt) throw new ActivityAdminError('找不到這場')
  const unpublished = s.status === SessionStatus.DRAFT || s.activity?.status === 'DRAFT'
  if (!unpublished) throw new ActivityAdminError('已發布的場次請用「取消場次」（會釋放場地並通知報名者）')
  const used = await seatsUsed([sessionId])
  if ((used.get(sessionId) ?? 0) > 0) throw new ActivityAdminError('這場已有報名或暫留，不能直接移除')
  await prisma.$transaction(async (tx) => {
    await releaseOccupancy(tx, sessionId)
    await tx.sessionCourt.deleteMany({ where: { sessionId } })
    await tx.session.delete({ where: { id: sessionId } })
  }, TX_OPTIONS)
  await prisma.auditLog.create({ data: { actor, action: 'ACTIVITY_SESSION_REMOVE', target: s.activity?.title ?? s.title, detail: { sessionId } } })
}

/** 表單選時間後查每面場地是否可用（含緩衝）；excludeSessionId 用於修改既有場次 */
export async function courtAvailabilityForForm(params: { date: string; startMinute: number; endMinute: number; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; excludeSessionId?: string | null }) {
  const venue = await primaryVenue()
  const rangeError = validateRange(venue, params.startMinute, params.endMinute)
  if (rangeError) return { error: rangeError, courts: [] as { courtId: string; name: string; ok: boolean; reasons: string[] }[] }
  const occ = withBuffer(venue, params.startMinute, params.endMinute, params.bufferBeforeMinutes ?? 0, params.bufferAfterMinutes ?? 0)
  const m = await findConflicts({ venue, courts: venue.courts, ranges: [{ date: params.date, ...occ }], excludeSessionIds: params.excludeSessionId ? [params.excludeSessionId] : [] })
  const list = m.get(params.date) ?? []
  return {
    error: null,
    occupyLabel: activityTimeLabel(occ.startMinute, occ.endMinute),
    courts: venue.courts.map((c) => {
      const cs = list.filter((x) => x.courtId === c.id)
      return { courtId: c.id, name: c.name, ok: c.active && cs.length === 0, reasons: !c.active ? ['停用或維護中'] : cs.map((x) => `${activityTimeLabel(x.startMinute, x.endMinute)} ${x.reason}`) }
    }),
  }
}
