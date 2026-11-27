import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, isValidDateString, slotStarts, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { allocateCollected, collectedBookings, financeTotals } from '@/server/finance-metrics'
import type { OverviewData, OverviewRange } from './overview-types'

const PRESETS = [7, 30, 90, 180] as const
const MAX_CUSTOM_DAYS = 366

/** 解析查看期間：近 N 天或自訂日期；自訂日期不合法時回到近 7 天並附上提示 */
export function parseOverviewRange(sp: { range?: string; from?: string; to?: string }): OverviewRange & { warning: string | null } {
  const today = taipeiDateString()
  const mk = (from: string, to: string, key: OverviewRange['key']) => {
    const days = Math.round((taipeiToUtc(to, 0).getTime() - taipeiToUtc(from, 0).getTime()) / 86_400_000) + 1
    return { key, from, to, days, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) }
  }
  if (sp.range === 'custom') {
    const ok = sp.from && sp.to && isValidDateString(sp.from) && isValidDateString(sp.to)
    if (ok && sp.from! <= sp.to! && sp.to! <= today) {
      const r = mk(sp.from!, sp.to!, 'custom')
      if (r.days <= MAX_CUSTOM_DAYS) return { ...r, warning: null }
      return { ...mk(addDays(today, -6), today, '7'), warning: `自訂期間最長 ${MAX_CUSTOM_DAYS} 天，已改為近 7 天` }
    }
    return { ...mk(addDays(today, -6), today, '7'), warning: '自訂日期不完整或不正確（結束日不可早於開始日或晚於今天），已改為近 7 天' }
  }
  const n = PRESETS.find((x) => String(x) === sp.range) ?? 7
  return { ...mk(addDays(today, -(n - 1)), today, String(n) as OverviewRange['key']), warning: null }
}

const utc = (from: string, to: string) => ({ fromUtc: taipeiToUtc(from, 0), toUtc: taipeiToUtc(addDays(to, 1), 0) })
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null)
const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export async function overviewData(r: OverviewRange, courtId?: string): Promise<OverviewData | null> {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { orderBy: { sortOrder: 'asc' } } } })
  if (!venue) return null
  const openCourts = venue.courts.filter((c) => c.active)
  const scope = courtId && venue.courts.some((c) => c.id === courtId) ? venue.courts.filter((c) => c.id === courtId) : openCourts
  const scopeIds = scope.map((c) => c.id)
  const slots = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes)
  const cur = utc(r.from, r.to)
  const prev = utc(r.prevFrom, r.prevTo)
  const now = new Date()

  const [curRes, prevResCount, curFin, prevFin, membersNow, membersPrev, revBookings, topups, nowRes] = await Promise.all([
    prisma.reservation.findMany({ where: { courtId: { in: scopeIds }, startsAt: { gte: cur.fromUtc, lt: cur.toUtc }, status: { in: ['BOOKED', 'EVENT'] } }, select: { courtId: true, startsAt: true } }),
    prisma.reservation.count({ where: { courtId: { in: scopeIds }, startsAt: { gte: prev.fromUtc, lt: prev.toUtc }, status: { in: ['BOOKED', 'EVENT'] } } }),
    financeTotals(cur),
    financeTotals(prev),
    prisma.user.count({ where: { createdAt: { lt: cur.toUtc } } }),
    prisma.user.count({ where: { createdAt: { lt: prev.toUtc } } }),
    collectedBookings(cur),
    prisma.topUpOrder.findMany({ where: { status: { in: ['PAID', 'CREDITED', 'CREDIT_FAILED'] }, paidAt: { gte: cur.fromUtc, lt: cur.toUtc } }, select: { amount: true, paidAt: true } }),
    prisma.reservation.findMany({ where: { courtId: { in: venue.courts.map((c) => c.id) }, startsAt: { lte: now, gt: new Date(now.getTime() - venue.slotMinutes * 60_000) } }, select: { courtId: true, status: true } }),
  ])

  // ── 使用率：已預約／活動占用時段 ÷（場地數 × 每日時段 × 天數）
  const capacityPerDay = Math.max(1, scope.length * slots.length)
  const days: string[] = []
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) days.push(d)
  const perDay = new Map(days.map((d) => [d, 0]))
  const perCourt = new Map(scopeIds.map((id) => [id, 0]))
  const cell = new Map<string, number>()
  const weekdayCount = new Map<number, number>()
  for (const d of days) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
    weekdayCount.set(wd, (weekdayCount.get(wd) ?? 0) + 1)
  }
  for (const x of curRes) {
    const d = taipeiDateString(x.startsAt)
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
    perCourt.set(x.courtId, (perCourt.get(x.courtId) ?? 0) + 1)
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
    const hour = Math.floor(taipeiMinuteOfDay(x.startsAt) / 60)
    cell.set(`${wd}:${hour}`, (cell.get(`${wd}:${hour}`) ?? 0) + 1)
  }
  const rate = (n: number, ndays: number) => Math.round((n / (capacityPerDay * ndays)) * 1000) / 10
  const curRate = curRes.length ? rate(curRes.length, r.days) : 0
  const prevRate = prevResCount ? rate(prevResCount, r.days) : 0

  // 長期間改以週／月彙總，圖表才讀得懂
  const bucketOf = (d: string) => (r.days <= 31 ? d : r.days <= 92 ? addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7)) : d.slice(0, 7))
  const bucketLabel = (b: string) => (r.days <= 31 ? b.slice(5).replace('-', '/') : r.days <= 92 ? `${b.slice(5).replace('-', '/')} 週` : `${Number(b.slice(5))} 月`)
  const buckets = [...new Set(days.map(bucketOf))]
  const daysIn = new Map<string, number>()
  for (const d of days) daysIn.set(bucketOf(d), (daysIn.get(bucketOf(d)) ?? 0) + 1)
  const usage = buckets.map((b) => {
    const n = days.filter((d) => bucketOf(d) === b).reduce((s, d) => s + (perDay.get(d) ?? 0), 0)
    return { label: bucketLabel(b), value: rate(n, daysIn.get(b) ?? 1) }
  })

  // ── 熱力圖：星期 × 小時，以該星期在期間內出現的次數平均
  const hours = [...new Set(slots.map((m) => Math.floor(m / 60)))]
  const order = [1, 2, 3, 4, 5, 6, 0]
  const heatmap = order.map((wd) => ({
    label: WEEKDAY[wd],
    values: hours.map((h) => {
      const times = weekdayCount.get(wd) ?? 0
      return times ? Math.min(100, Math.round(((cell.get(`${wd}:${h}`) ?? 0) / (scope.length * times)) * 100)) : 0
    }),
  }))

  // ── 營收：實收依付款時間（與財務報表同一算法）
  const revByBucket = new Map(buckets.map((b) => [b, { court: 0, event: 0, topup: 0 }]))
  let courtRev = 0
  let eventRev = 0
  for (const b of revBookings) {
    const bucket = revByBucket.get(bucketOf(taipeiDateString(b.paidAt!)))
    for (const line of allocateCollected(b)) {
      if (line.type === 'EVENT') { eventRev += line.amount; if (bucket) bucket.event += line.amount }
      else { courtRev += line.amount; if (bucket) bucket.court += line.amount }
    }
  }
  let topupRev = 0
  for (const t of topups) {
    topupRev += t.amount
    const bucket = t.paidAt ? revByBucket.get(bucketOf(taipeiDateString(t.paidAt))) : undefined
    if (bucket) bucket.topup += t.amount
  }
  const revenueSeries = buckets.map((b) => {
    const v = revByBucket.get(b)!
    return { label: bucketLabel(b), court: v.court, event: v.event, topup: v.topup, total: v.court + v.event + v.topup }
  })

  // ── 場地圖：目前狀態 ＋ 期間使用率
  const nowMap = new Map(nowRes.map((x) => [x.courtId, x.status]))
  const courts = venue.courts.map((c) => {
    const st = nowMap.get(c.id)
    const status = c.status === 'MAINTENANCE' ? 'MAINTENANCE' : c.status === 'INACTIVE' || !c.active ? 'SUSPENDED' : st === 'BLOCKED' ? 'MAINTENANCE' : st === 'BOOKED' || st === 'EVENT' ? 'IN_USE' : 'AVAILABLE'
    return { id: c.id, name: c.name, status: status as OverviewData['courts'][number]['status'], rate: perCourt.has(c.id) ? rate(perCourt.get(c.id) ?? 0, r.days) : null }
  })

  const hasData = curRes.length > 0 || curFin.collected > 0 || curFin.orders > 0
  return {
    range: r,
    venueName: venue.name,
    courtOptions: openCourts.map((c) => ({ id: c.id, name: c.name })),
    courtId: scope.length === 1 && courtId ? courtId : null,
    hasData,
    kpi: {
      utilization: { value: curRate, prev: prevRate, change: prevRate > 0 ? Math.round((curRate - prevRate) * 10) / 10 : null },
      revenue: { value: curFin.collected + curFin.topup, prev: prevFin.collected + prevFin.topup, change: pct(curFin.collected + curFin.topup, prevFin.collected + prevFin.topup) },
      orders: { value: curFin.orders, prev: prevFin.orders, change: pct(curFin.orders, prevFin.orders) },
      members: { value: membersNow, prev: membersPrev, change: pct(membersNow, membersPrev) },
    },
    usage,
    heatmap: { hours: hours.map((h) => `${String(h).padStart(2, '0')}:00`), rows: heatmap },
    courts,
    revenue: {
      series: revenueSeries,
      sources: [
        { key: 'court', label: '預約', amount: courtRev, available: true },
        { key: 'event', label: '活動收入', amount: eventRev, available: true },
        { key: 'topup', label: '會員方案（儲值）', amount: topupRev, available: true },
        { key: 'product', label: '商品收入', amount: 0, available: false },
        { key: 'other', label: '其他收入', amount: 0, available: false },
      ],
    },
  }
}
