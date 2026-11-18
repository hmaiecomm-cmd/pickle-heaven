import 'server-only'
import type { Prisma, RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { addDays, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from '@/lib/activity-shared'
import { allocateCollected, collectedBookings } from './finance-metrics'

export const ACTIVITY_PAGE_SIZE = 12

const LIVE_REG: RegistrationStatus[] = ['CONFIRMED', 'WAITLISTED', 'COMPLETED', 'NO_SHOW', 'LATE_CANCEL']
const SEATED: RegistrationStatus[] = ['CONFIRMED', 'COMPLETED', 'NO_SHOW']

export interface ActivityOrderFilters {
  q: string
  from: string
  to: string
  reg: '' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'
  pay: '' | 'PAID' | 'PENDING' | 'FAILED'
  attend: '' | 'CHECKED_IN' | 'NO_SHOW' | 'NOT_YET'
  member: '' | 'VIP' | 'BASIC'
  page: number
}

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function parseActivityFilters(sp: Record<string, string | undefined>): ActivityOrderFilters {
  const pick = <T extends string>(v: string | undefined, ok: readonly T[]): T | '' => (ok.includes(v as T) ? (v as T) : '')
  return {
    q: (sp.q ?? '').trim().slice(0, 50),
    from: isDate(sp.from) ? sp.from! : '',
    to: isDate(sp.to) ? sp.to! : '',
    reg: pick(sp.reg, ['CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const),
    pay: pick(sp.pay, ['PAID', 'PENDING', 'FAILED'] as const),
    attend: pick(sp.attend, ['CHECKED_IN', 'NO_SHOW', 'NOT_YET'] as const),
    member: pick(sp.member, ['VIP', 'BASIC'] as const),
    page: Math.max(1, Number(sp.page) || 1),
  }
}

/** 頂部統計：只讀既有場次、報名與付款紀錄；活動收入與財務頁同一算法（實收分攤到活動明細） */
export async function activityOrderStats(withRevenue: boolean) {
  const today = taipeiDateString()
  const now = new Date()
  const todayFrom = taipeiToUtc(today, 0)
  const todayTo = taipeiToUtc(addDays(today, 1), 0)
  const activeSession: Prisma.SessionWhereInput = { deletedAt: null, status: { in: ['OPEN', 'FULL', 'LOCKED', 'PLAYING', 'SCHEDULED'] }, endAt: { gte: now } }
  const monthStart = `${today.slice(0, 7)}-01`
  const [ongoing, todayRegs, vip, waitlist, collected] = await Promise.all([
    prisma.session.count({ where: activeSession }),
    prisma.sessionRegistration.aggregate({ where: { registeredAt: { gte: todayFrom, lt: todayTo }, status: { in: LIVE_REG } }, _sum: { seats: true } }),
    prisma.sessionRegistration.aggregate({ where: { session: activeSession, status: { in: SEATED }, user: { membershipLevel: 'VIP' } }, _sum: { seats: true } }),
    prisma.sessionRegistration.aggregate({ where: { session: activeSession, status: 'WAITLISTED' }, _sum: { seats: true } }),
    withRevenue ? collectedBookings({ fromUtc: taipeiToUtc(monthStart, 0), toUtc: todayTo }) : Promise.resolve(null),
  ])
  const revenue = collected ? collected.flatMap(allocateCollected).filter((l) => l.type === 'EVENT').reduce((s, l) => s + l.amount, 0) : null
  return {
    ongoing,
    todaySignups: todayRegs._sum.seats ?? 0,
    vip: vip._sum.seats ?? 0,
    waitlist: waitlist._sum.seats ?? 0,
    monthRevenue: revenue,
  }
}

export type ActivityOrderStats = Awaited<ReturnType<typeof activityOrderStats>>

/** 每場活動一張卡片；篩選條件作用在報名紀錄上，卡片內的數字仍是整場的統計 */
export async function listActivityOrders(f: ActivityOrderFilters) {
  const today = taipeiDateString()
  const from = f.from || addDays(today, -30)
  const to = f.to || addDays(today, 60)

  const regWhere: Prisma.SessionRegistrationWhereInput = {}
  if (f.reg === 'CONFIRMED') regWhere.status = { in: SEATED }
  if (f.reg === 'WAITLISTED') regWhere.status = 'WAITLISTED'
  if (f.reg === 'CANCELLED') regWhere.status = { in: ['CANCELLED', 'LATE_CANCEL'] }
  if (f.attend === 'CHECKED_IN') regWhere.checkedInAt = { not: null }
  if (f.attend === 'NO_SHOW') regWhere.status = 'NO_SHOW'
  if (f.attend === 'NOT_YET') {
    regWhere.checkedInAt = null
    if (!f.reg) regWhere.status = 'CONFIRMED'
  }
  if (f.member) regWhere.user = { membershipLevel: f.member }
  if (f.pay) regWhere.bookingId = { in: (await prisma.booking.findMany({ where: { activityItems: { some: {} }, status: f.pay === 'PAID' ? { in: ['PAID', 'COMPLETED'] } : f.pay === 'PENDING' ? 'PENDING' : { in: ['EXPIRED', 'REFUND_PENDING'] } }, select: { id: true } })).map((b) => b.id) }

  const where: Prisma.SessionWhereInput = {
    deletedAt: null,
    status: { not: 'DRAFT' },
    startAt: { gte: taipeiToUtc(from, 0), lt: taipeiToUtc(addDays(to, 1), 0) },
    ...(f.q ? { OR: [{ title: { contains: f.q } }, { activity: { title: { contains: f.q } } }] } : {}),
    ...(Object.keys(regWhere).length ? { registrations: { some: regWhere } } : {}),
  }

  const [total, sessions] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.findMany({
      where,
      orderBy: { startAt: 'asc' },
      skip: (f.page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      include: {
        activity: { select: { title: true, type: true, customTypeLabel: true, coverAssetId: true } },
        registrations: { select: { status: true, seats: true, checkedInAt: true, bookingId: true, user: { select: { membershipLevel: true } } } },
      },
    }),
  ])

  const bookingIds = [...new Set(sessions.flatMap((s) => s.registrations.map((r) => r.bookingId).filter((x): x is string => !!x)))]
  const bookings = bookingIds.length ? await prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, status: true } }) : []
  const bookingStatus = new Map(bookings.map((b) => [b.id, b.status]))

  const rows = sessions.map((s) => {
    const regs = s.registrations
    const sum = (pred: (r: (typeof regs)[number]) => boolean) => regs.filter(pred).reduce((n, r) => n + r.seats, 0)
    const seated = (r: (typeof regs)[number]) => SEATED.includes(r.status)
    const pay = (st: string[]) => regs.filter((r) => r.bookingId && st.includes(bookingStatus.get(r.bookingId) ?? '')).length
    const type = (s.activity?.type ?? 'OPEN_PLAY') as ActivityTypeKey
    const cover = s.coverAssetId ?? s.activity?.coverAssetId ?? null
    return {
      id: s.id,
      title: s.activity?.title ?? s.title,
      typeLabel: type === 'OTHER' && s.activity?.customTypeLabel ? s.activity.customTypeLabel : ACTIVITY_TYPE_LABEL[type],
      cover: cover ? `/media/${cover}` : null,
      startAt: s.startAt.toISOString(),
      status: s.status,
      capacity: s.capacity,
      price: s.price,
      signed: sum(seated),
      vip: sum((r) => seated(r) && r.user.membershipLevel === 'VIP'),
      waitlist: sum((r) => r.status === 'WAITLISTED'),
      cancelled: regs.filter((r) => r.status === 'CANCELLED' || r.status === 'LATE_CANCEL').length,
      checkedIn: regs.filter((r) => r.checkedInAt || r.status === 'COMPLETED').length,
      noShow: regs.filter((r) => r.status === 'NO_SHOW').length,
      paid: pay(['PAID', 'COMPLETED']),
      pending: pay(['PENDING']),
      failed: pay(['EXPIRED', 'REFUND_PENDING', 'CANCELLED']),
    }
  })

  return { rows, total, pages: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)), from, to }
}

export type ActivityOrderRow = Awaited<ReturnType<typeof listActivityOrders>>['rows'][number]
