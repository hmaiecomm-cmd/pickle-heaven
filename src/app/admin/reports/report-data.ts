import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, slotStarts, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { financeTotals } from '@/server/finance-metrics'

/** 報表共用：期間（以台北日期計）與基本資料 */
export function periodOf(days: string | undefined) {
  const n = [12, 30, 90].includes(Number(days)) ? Number(days) : 12
  const to = taipeiDateString()
  const from = addDays(to, -(n - 1))
  return { days: n, from, to, fromUtc: taipeiToUtc(from, 0), toUtc: taipeiToUtc(addDays(to, 1), 0) }
}

/** 營運總覽的圖形化資料：只讀現有預約、付款、儲值與異常紀錄，不產生展示假資料。 */
export async function operationsDashboard(p: Period, courtId?: string) {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } })
  if (!venue) return null
  const slots = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes)
  const courtIds = courtId && venue.courts.some((c) => c.id === courtId) ? [courtId] : venue.courts.map((c) => c.id)
  const [reservations, bookings, topUps] = await Promise.all([
    prisma.reservation.findMany({ where: { courtId: { in: courtIds }, startsAt: { gte: p.fromUtc, lt: p.toUtc }, status: { in: ['BOOKED', 'EVENT'] } }, select: { courtId: true, startsAt: true, status: true } }),
    prisma.booking.findMany({ where: { paidAt: { gte: p.fromUtc, lt: p.toUtc }, payments: { some: { status: { in: ['SUCCESS', 'REFUNDED'] } } } }, include: { items: { select: { price: true } }, activityItems: { select: { amount: true } }, payments: { where: { status: { in: ['SUCCESS', 'REFUNDED'] } }, select: { amount: true } } } }),
    prisma.topUpOrder.aggregate({ where: { status: { in: ['PAID', 'CREDITED', 'CREDIT_FAILED'] }, paidAt: { gte: p.fromUtc, lt: p.toUtc } }, _sum: { amount: true } }),
  ])
  const days: string[] = []
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) days.push(d)
  const dayIndex = new Map(days.map((d, i) => [d, i]))
  const hourSlots = slots.map((m) => Math.floor(m / 60))
  const cellMap = new Map<string, number>()
  const dayUse = days.map(() => 0)
  const courtUse = new Map(courtIds.map((id) => [id, 0]))
  for (const r of reservations) {
    const date = taipeiDateString(r.startsAt)
    const di = dayIndex.get(date)
    if (di === undefined) continue
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: '2-digit', hour12: false }).format(r.startsAt))
    const si = hourSlots.findIndex((h) => h === hour)
    if (si < 0) continue
    const key = `${di}:${si}`
    cellMap.set(key, (cellMap.get(key) ?? 0) + 1)
    dayUse[di] += 1
    courtUse.set(r.courtId, (courtUse.get(r.courtId) ?? 0) + 1)
  }
  const capacity = Math.max(1, courtIds.length * slots.length)
  const heatmap = days.flatMap((_, di) => hourSlots.map((_, si) => ({ dayIndex: di, slotIndex: si, rate: Math.round(((cellMap.get(`${di}:${si}`) ?? 0) / Math.max(1, courtIds.length)) * 100) })))
  const usage = days.map((d, i) => ({ label: d.slice(5).replace('-', '/'), value: Math.round((dayUse[i] / capacity) * 100) }))
  const peak = hourSlots.map((h, i) => ({ label: `${String(h).padStart(2, '0')}:00`, value: Math.round(((days.length ? [...cellMap.entries()].filter(([k]) => Number(k.split(':')[1]) === i).reduce((s, [, v]) => s + v, 0) / days.length : 0) / Math.max(1, courtIds.length)) * 100) }))
  const revenue = { court: 0, event: 0 }
  for (const b of bookings) {
    const total = b.payments.reduce((s, x) => s + x.amount, 0)
    const base = b.items.reduce((s, x) => s + x.price, 0) + b.activityItems.reduce((s, x) => s + x.amount, 0)
    if (base <= 0) revenue.court += total
    else { revenue.court += Math.round(total * b.items.reduce((s, x) => s + x.price, 0) / base); revenue.event += total - Math.round(total * b.items.reduce((s, x) => s + x.price, 0) / base) }
  }
  return { venue, slots, days, heatmap, usage, peak, courts: venue.courts.filter((c) => courtIds.includes(c.id)).map((c) => ({ name: c.name, rate: Math.round(((courtUse.get(c.id) ?? 0) / Math.max(1, slots.length * days.length)) * 100) })).sort((a, b) => b.rate - a.rate), revenue: { ...revenue, topup: topUps._sum.amount ?? 0 }, productDataAvailable: false }
}

export type Period = ReturnType<typeof periodOf>

/** 今天（台北時間）的期間 */
export function todayPeriod(): Period {
  const d = taipeiDateString()
  return { days: 1, from: d, to: d, fromUtc: taipeiToUtc(d, 0), toUtc: taipeiToUtc(addDays(d, 1), 0) }
}

export async function overview(p: Period) {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { where: { active: true } } } })
  const [ordered, totals, bookings, cancelled] = await Promise.all([
    prisma.booking.aggregate({ where: { createdAt: { gte: p.fromUtc, lt: p.toUtc } }, _sum: { subtotal: true }, _count: { _all: true } }),
    financeTotals(p),
    prisma.booking.count({ where: { playDate: { gte: p.from, lte: p.to }, status: { in: ['PAID', 'COMPLETED'] } } }),
    prisma.booking.count({ where: { cancelledAt: { gte: p.fromUtc, lt: p.toUtc } } }),
  ])
  return {
    venue,
    orderAmount: ordered._sum.subtotal ?? 0,
    orderCount: ordered._count._all,
    totals,
    collected: totals.collected,
    paidCount: totals.orders,
    refunded: totals.refunded,
    refundedPoints: totals.refundedPoints,
    refundCount: totals.refundCount,
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
