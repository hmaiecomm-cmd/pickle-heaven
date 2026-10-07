import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, slotStarts, taipeiDateString, taipeiToUtc } from '@/lib/time'

/** 報表共用：期間（以台北日期計）與基本資料 */
export function periodOf(days: string | undefined) {
  const n = [7, 30, 90].includes(Number(days)) ? Number(days) : 30
  const to = taipeiDateString()
  const from = addDays(to, -(n - 1))
  return { days: n, from, to, fromUtc: taipeiToUtc(from, 0), toUtc: taipeiToUtc(addDays(to, 1), 0) }
}

export type Period = ReturnType<typeof periodOf>

export async function overview(p: Period) {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { where: { active: true } } } })
  const [ordered, paid, refunds, bookings, cancelled] = await Promise.all([
    prisma.booking.aggregate({ where: { createdAt: { gte: p.fromUtc, lt: p.toUtc } }, _sum: { subtotal: true }, _count: { _all: true } }),
    prisma.booking.aggregate({ where: { paidAt: { gte: p.fromUtc, lt: p.toUtc }, payments: { some: { status: { in: ['SUCCESS', 'REFUNDED'] } } } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.refund.aggregate({ where: { status: { in: ['SUCCEEDED', 'MANUAL_DONE'] }, completedAt: { gte: p.fromUtc, lt: p.toUtc } }, _sum: { cashAmount: true, pointsAmount: true }, _count: { _all: true } }),
    prisma.booking.count({ where: { playDate: { gte: p.from, lte: p.to }, status: { in: ['PAID', 'COMPLETED'] } } }),
    prisma.booking.count({ where: { cancelledAt: { gte: p.fromUtc, lt: p.toUtc } } }),
  ])
  return {
    venue,
    orderAmount: ordered._sum.subtotal ?? 0,
    orderCount: ordered._count._all,
    collected: paid._sum.total ?? 0,
    paidCount: paid._count._all,
    refunded: refunds._sum.cashAmount ?? 0,
    refundedPoints: refunds._sum.pointsAmount ?? 0,
    refundCount: refunds._count._all,
    playedBookings: bookings,
    cancelled,
  }
}

export async function utilization(p: Period) {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } })
  if (!venue) return null
  const slotsPerDay = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes).length
  const rows = await prisma.reservation.groupBy({
    by: ['courtId', 'status'],
    where: { courtId: { in: venue.courts.map((c) => c.id) }, startsAt: { gte: taipeiToUtc(p.from, venue.openMinute), lt: taipeiToUtc(addDays(p.to, 1), 0) }, status: { in: ['BOOKED', 'EVENT', 'BLOCKED'] } },
    _count: { _all: true },
  })
  return {
    slotMinutes: venue.slotMinutes,
    courts: venue.courts.map((c) => {
      const get = (s: string) => rows.find((r) => r.courtId === c.id && r.status === s)?._count._all ?? 0
      const total = slotsPerDay * p.days
      const booked = get('BOOKED')
      const event = get('EVENT')
      const blocked = get('BLOCKED')
      return { name: c.name, total, booked, event, blocked, rate: total ? Math.round(((booked + event) / total) * 100) : 0 }
    }),
  }
}

export async function activityStats(p: Period) {
  const sessions = await prisma.session.findMany({
    where: { deletedAt: null, startAt: { gte: p.fromUtc, lt: p.toUtc }, status: { not: 'DRAFT' } },
    include: { registrations: { select: { status: true, seats: true, checkedInAt: true } } },
    orderBy: { startAt: 'asc' },
  })
  return sessions.map((s) => {
    const confirmed = s.registrations.filter((r) => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(r.status)).reduce((a, r) => a + r.seats, 0)
    const cap = Math.max(1, s.capacity - s.reservedCapacity)
    return { id: s.id, title: s.title, startAt: s.startAt, status: s.status, capacity: cap, confirmed, fill: Math.round((confirmed / cap) * 100), checkedIn: s.registrations.filter((r) => r.checkedInAt).length }
  })
}

export async function memberStats(p: Period) {
  const [total, newMembers, activeIds, restricted, top] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: p.fromUtc, lt: p.toUtc } } }),
    prisma.booking.findMany({ where: { status: { in: ['PAID', 'COMPLETED'] }, playDate: { gte: p.from, lte: p.to } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.memberRestriction.count({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.booking.groupBy({ by: ['userId'], where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: p.fromUtc, lt: p.toUtc } }, _sum: { total: true }, _count: { _all: true }, orderBy: { _sum: { total: 'desc' } }, take: 10 }),
  ])
  const users = await prisma.user.findMany({ where: { id: { in: top.map((t) => t.userId) } }, select: { id: true, displayName: true } })
  return {
    total,
    newMembers,
    active: activeIds.length,
    restricted,
    top: top.map((t) => ({ userId: t.userId, name: users.find((u) => u.id === t.userId)?.displayName ?? '—', amount: t._sum.total ?? 0, count: t._count._all })),
  }
}
