import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { isFinanceRange, resolveFinanceRange, type FinanceRange } from '@/lib/finance-range'
import { addDays, isValidDateString, slotStarts, taipeiDateString, taipeiToUtc } from '@/lib/time'

/**
 * AI 管理助理可用的工具。
 * 除了 propose_action 之外全部唯讀；propose_action 只產生預覽，絕不執行。
 * 每個工具回傳 { data, source, period?, note }，伺服器據此組出回覆的「資料期間／來源／計算說明」，
 * 不依賴模型自述，確保這些欄位與實際查詢一致。
 */

export interface ToolOutcome {
  data: unknown
  source: string
  note: string
  period?: { from: Date; to: Date }
}

export interface ActionPreview {
  actionType: string
  title: string
  items: string[]
  impact: string
}

const RANGE_ENUM = ['today', 'week', 'month', 'quarter', 'year'] as const
const RANGE_LABEL: Record<FinanceRange, string> = { today: '今天', week: '本週', month: '本月', quarter: '本季', year: '今年' }

const obj = (properties: Record<string, unknown>) => ({
  type: 'object' as const,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

export const AI_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_financial_summary',
    description: '取得指定期間的營收、費用、淨收入與利潤率，並附上前一個同長度期間的數字供比較。營收以已付款／已完成訂單的實收金額計，費用以已核准的費用計。',
    strict: true,
    input_schema: obj({ range: { type: 'string', enum: RANGE_ENUM, description: '期間：today 今天、week 本週（週日起）、month 本月、quarter 本季、year 今年' } }),
  },
  {
    name: 'get_revenue_breakdown',
    description: '取得指定期間的營收拆解：依球場、依付款方式、依日期（每日加總）。',
    strict: true,
    input_schema: obj({ range: { type: 'string', enum: RANGE_ENUM } }),
  },
  {
    name: 'list_bookings',
    description: '列出場地預約訂單（最多 50 筆，新到舊）。可依狀態與打球日期篩選。回傳訂單編號、聯絡人姓名、打球日期、金額、狀態與時段。',
    strict: true,
    input_schema: obj({
      status: { type: 'string', enum: ['ALL', 'PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'EXPIRED'], description: 'PENDING 待付款、PAID 已付款、COMPLETED 已完成、CANCELLED 已取消、EXPIRED 逾時未付' },
      from_date: { type: 'string', description: '打球日期起（YYYY-MM-DD，含）；不限則傳空字串' },
      to_date: { type: 'string', description: '打球日期迄（YYYY-MM-DD，含）；不限則傳空字串' },
      limit: { type: 'integer', description: '筆數上限，1–50' },
    }),
  },
  {
    name: 'get_court_utilization',
    description: '計算各球場在日期區間內的使用率：已成立預約的時段數 ÷ 營業時段總數。區間最長 31 天。',
    strict: true,
    input_schema: obj({
      from_date: { type: 'string', description: 'YYYY-MM-DD' },
      to_date: { type: 'string', description: 'YYYY-MM-DD，含當日' },
    }),
  },
  {
    name: 'get_member_overview',
    description: '取得會員概況：總數、各等級人數、近 30 天新加入人數、消費前五名、點數餘額總和。',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'list_expenses',
    description: '列出指定期間（依提交日期）的費用，可依審核狀態篩選，並附各類別與狀態的加總。',
    strict: true,
    input_schema: obj({
      range: { type: 'string', enum: RANGE_ENUM },
      status: { type: 'string', enum: ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
    }),
  },
  {
    name: 'list_invoices',
    description: '列出發票（最多 50 筆）。已開立且超過到期日者標示為逾期。',
    strict: true,
    input_schema: obj({ status: { type: 'string', enum: ['ALL', 'DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'] } }),
  },
  {
    name: 'get_sessions_overview',
    description: '列出未來 14 天的球敘場次：名稱、時間、名額、正取與候補人數、狀態。',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'propose_action',
    description:
      '當擁有者要求任何會改變資料或對外發送的操作（取消訂單、退款、群發通知、改價、改球場狀態等）時，呼叫此工具產生「操作預覽」交給擁有者確認。此工具不會執行任何操作。呼叫前請先用查詢工具找出實際受影響的項目。',
    strict: true,
    input_schema: obj({
      action_type: { type: 'string', enum: ['cancel_bookings', 'refund', 'send_notification', 'change_price', 'change_court_status', 'other'] },
      title: { type: 'string', description: '操作名稱，例如「批次取消待付款訂單」' },
      items: { type: 'array', items: { type: 'string' }, description: '受影響的項目，每項一行，例如「PH002 王曉明 NT$1,000（待付款）」' },
      impact: { type: 'string', description: '影響說明：筆數、金額、是否可逆、是否需通知會員' },
    }),
  },
]

const money = (n: number) => `NT$${n.toLocaleString('en-US')}`

function rangeOf(input: Record<string, unknown>): FinanceRange {
  const r = input.range
  return isFinanceRange(r) ? r : 'month'
}

function dateArg(v: unknown): string | null {
  return typeof v === 'string' && isValidDateString(v) ? v : null
}

async function revenueBetween(from: Date, to: Date) {
  const agg = await prisma.booking.aggregate({
    where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: from, lt: to } },
    _sum: { total: true },
    _count: { _all: true },
  })
  const exp = await prisma.expense.aggregate({ where: { status: 'APPROVED', submittedAt: { gte: from, lt: to } }, _sum: { amount: true } })
  const revenue = agg._sum.total ?? 0
  const expenses = exp._sum.amount ?? 0
  return { revenue, bookings: agg._count._all, expenses, net: revenue - expenses }
}

type Handler = (input: Record<string, unknown>) => Promise<ToolOutcome>

const HANDLERS: Record<string, Handler> = {
  async get_financial_summary(input) {
    const range = rangeOf(input)
    const { from, to } = resolveFinanceRange(range)
    const span = to.getTime() - from.getTime()
    const [cur, prev] = await Promise.all([revenueBetween(from, to), revenueBetween(new Date(from.getTime() - span), from)])
    const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10)
    return {
      data: {
        period: RANGE_LABEL[range],
        current: { ...cur, profitMarginPct: cur.revenue > 0 ? Math.round((cur.net / cur.revenue) * 1000) / 10 : null },
        previousPeriod: prev,
        revenueChangePct: pct(cur.revenue, prev.revenue),
      },
      source: '訂單（Booking）、費用（Expense）',
      period: { from, to },
      note: '營收 = 期間內付款完成（已付款／已完成）的訂單實收；費用 = 已核准費用（依提交日）；比較基準為緊鄰的前一個同長度期間。',
    }
  },

  async get_revenue_breakdown(input) {
    const range = rangeOf(input)
    const { from, to } = resolveFinanceRange(range)
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: from, lt: to } },
      select: { total: true, paidAt: true, items: { select: { courtName: true, price: true } }, payments: { where: { status: 'SUCCESS' }, select: { method: true }, take: 1 } },
      take: 2000,
    })
    const byCourt = new Map<string, number>()
    const byMethod = new Map<string, number>()
    const byDay = new Map<string, number>()
    for (const b of bookings) {
      const subtotal = b.items.reduce((s, i) => s + i.price, 0) || 1
      for (const it of b.items) byCourt.set(it.courtName, (byCourt.get(it.courtName) ?? 0) + Math.round((b.total * it.price) / subtotal))
      const m = b.payments[0]?.method ?? 'UNKNOWN'
      byMethod.set(m, (byMethod.get(m) ?? 0) + b.total)
      const d = taipeiDateString(b.paidAt ?? new Date())
      byDay.set(d, (byDay.get(d) ?? 0) + b.total)
    }
    const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, revenue: v }))
    return {
      data: { period: RANGE_LABEL[range], orderCount: bookings.length, byCourt: sorted(byCourt), byPaymentMethod: sorted(byMethod), byDay: [...byDay].sort().map(([day, revenue]) => ({ day, revenue })) },
      source: '訂單（Booking）、訂單項目（BookingItem）、付款（Payment）',
      period: { from, to },
      note: '依球場的金額按各時段原價比例分攤訂單實收（含折扣）；依日期以付款日（台北時間）歸屬。',
    }
  },

  async list_bookings(input) {
    const status = typeof input.status === 'string' ? input.status : 'ALL'
    const fromDate = dateArg(input.from_date)
    const toDate = dateArg(input.to_date)
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 20))
    const rows = await prisma.booking.findMany({
      where: {
        ...(status !== 'ALL' ? { status: status as 'PENDING' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' } : {}),
        ...(fromDate || toDate ? { playDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { code: true, contactName: true, playDate: true, total: true, status: true, expiresAt: true, items: { select: { courtName: true, startsAt: true, endsAt: true } } },
    })
    const fmt = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(11, 16)
    return {
      data: rows.map((b) => ({
        code: b.code,
        contactName: b.contactName,
        playDate: b.playDate,
        total: b.total,
        status: b.status,
        slots: b.items.map((i) => `${i.courtName} ${fmt(i.startsAt)}–${fmt(i.endsAt)}`),
        paymentDeadline: b.status === 'PENDING' ? b.expiresAt?.toISOString() ?? null : null,
      })),
      source: '訂單（Booking）',
      period: fromDate && toDate ? { from: taipeiToUtc(fromDate, 0), to: taipeiToUtc(toDate, 1440) } : undefined,
      note: `依建立時間新到舊，最多 ${limit} 筆${fromDate || toDate ? '；日期篩選依打球日' : ''}。`,
    }
  },

  async get_court_utilization(input) {
    const today = taipeiDateString()
    const fromDate = dateArg(input.from_date) ?? today
    let toDate = dateArg(input.to_date) ?? fromDate
    if (toDate < fromDate) toDate = fromDate
    if (addDays(fromDate, 30) < toDate) toDate = addDays(fromDate, 30)
    const venue = await prisma.venue.findFirst({ where: { active: true }, include: { courts: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } })
    if (!venue) return { data: { error: '尚未建立場館' }, source: '場館（Venue）', note: '' }
    const days: string[] = []
    for (let d = fromDate; d <= toDate; d = addDays(d, 1)) days.push(d)
    const slotsPerDay = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes).length
    const from = taipeiToUtc(fromDate, 0)
    const to = taipeiToUtc(toDate, 1440)
    const booked = await prisma.reservation.groupBy({
      by: ['courtId'],
      where: { courtId: { in: venue.courts.map((c) => c.id) }, status: 'BOOKED', startsAt: { gte: from, lt: to } },
      _count: { _all: true },
    })
    const byCourt = new Map(booked.map((b) => [b.courtId, b._count._all]))
    const available = slotsPerDay * days.length
    const courts = venue.courts.map((c) => {
      const n = byCourt.get(c.id) ?? 0
      return { court: c.name, bookedSlots: n, availableSlots: available, utilizationPct: available ? Math.round((n / available) * 1000) / 10 : 0 }
    })
    const totalBooked = courts.reduce((s, c) => s + c.bookedSlots, 0)
    const totalAvail = available * courts.length
    return {
      data: { fromDate, toDate, days: days.length, slotMinutes: venue.slotMinutes, courts, overallUtilizationPct: totalAvail ? Math.round((totalBooked / totalAvail) * 1000) / 10 : 0 },
      source: '預約時段（Reservation）、場館營業時間（Venue）',
      period: { from, to },
      note: `使用率 = 已成立預約時段 ÷ 營業時段（每日 ${slotsPerDay} 個 ${venue.slotMinutes} 分鐘時段 × ${days.length} 天）；不含購物車暫扣與維護鎖定。`,
    }
  },

  async get_member_overview() {
    const since = new Date(Date.now() - 30 * 86400e3)
    const [total, byLevel, recent, points, top] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['membershipLevel'], _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.user.aggregate({ _sum: { points: true } }),
      prisma.booking.groupBy({ by: ['userId'], where: { status: { in: ['PAID', 'COMPLETED'] } }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 5 }),
    ])
    const users = await prisma.user.findMany({ where: { id: { in: top.map((t) => t.userId) } }, select: { id: true, displayName: true, membershipLevel: true } })
    const name = new Map(users.map((u) => [u.id, u]))
    return {
      data: {
        totalMembers: total,
        byLevel: Object.fromEntries(byLevel.map((l) => [l.membershipLevel, l._count._all])),
        newInLast30Days: recent,
        outstandingPoints: points._sum.points ?? 0,
        topSpenders: top.map((t) => ({ name: name.get(t.userId)?.displayName ?? '（已刪除）', level: name.get(t.userId)?.membershipLevel ?? null, totalSpent: t._sum.total ?? 0 })),
      },
      source: '會員（User）、訂單（Booking）',
      note: '累計消費以已付款／已完成訂單的實收計；點數 1 點 = NT$1。',
    }
  },

  async list_expenses(input) {
    const range = rangeOf(input)
    const status = typeof input.status === 'string' ? input.status : 'ALL'
    const { from, to } = resolveFinanceRange(range)
    const rows = await prisma.expense.findMany({
      where: { submittedAt: { gte: from, lt: to }, ...(status !== 'ALL' ? { status: status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}) },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: { expenseNumber: true, category: true, amount: true, status: true, description: true, submittedAt: true },
    })
    const sum = (key: 'category' | 'status') => Object.fromEntries([...rows.reduce((m, r) => m.set(r[key], (m.get(r[key]) ?? 0) + r.amount), new Map<string, number>())])
    return {
      data: { period: RANGE_LABEL[range], count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0), byCategory: sum('category'), byStatus: sum('status'), items: rows.slice(0, 30).map((r) => ({ ...r, submittedAt: taipeiDateString(r.submittedAt) })) },
      source: '費用（Expense）',
      period: { from, to },
      note: '依提交日期歸屬期間；財務報表只計入已核准（APPROVED）的費用。',
    }
  },

  async list_invoices(input) {
    const want = typeof input.status === 'string' ? input.status : 'ALL'
    const now = new Date()
    const rows = await prisma.invoice.findMany({
      where: want === 'OVERDUE' ? { status: 'ISSUED', dueDate: { lt: now } } : want !== 'ALL' ? { status: want as 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' } : {},
      orderBy: { issueDate: 'desc' },
      take: 50,
      include: { user: { select: { displayName: true } }, booking: { select: { code: true } } },
    })
    return {
      data: rows.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        member: i.user?.displayName ?? null,
        booking: i.booking?.code ?? null,
        amount: i.amount,
        status: i.status === 'ISSUED' && i.dueDate < now ? 'OVERDUE' : i.status,
        issueDate: taipeiDateString(i.issueDate),
        dueDate: taipeiDateString(i.dueDate),
      })),
      source: '發票（Invoice）',
      note: '逾期 = 狀態為已開立且今天已超過到期日。',
    }
  },

  async get_sessions_overview() {
    const now = new Date()
    const until = new Date(now.getTime() + 14 * 86400e3)
    const rows = await prisma.session.findMany({
      where: { deletedAt: null, startAt: { gte: now, lt: until }, status: { not: 'CANCELLED' } },
      orderBy: { startAt: 'asc' },
      take: 40,
      select: { title: true, startAt: true, capacity: true, price: true, status: true, registrations: { where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } }, select: { status: true } } },
    })
    return {
      data: rows.map((s) => ({
        title: s.title,
        startAt: new Date(s.startAt.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' '),
        capacity: s.capacity,
        confirmed: s.registrations.filter((r) => r.status === 'CONFIRMED').length,
        waitlisted: s.registrations.filter((r) => r.status === 'WAITLISTED').length,
        price: s.price,
        status: s.status,
      })),
      source: '球敘（Session）、報名（SessionRegistration）',
      period: { from: now, to: until },
      note: '報名率 = 正取人數 ÷ 名額；時間為台北時間。',
    }
  },
}

/** 執行一個工具。propose_action 由呼叫端處理（收集預覽，不執行）。 */
export async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
  const handler = HANDLERS[name]
  if (!handler) throw new Error(`未知的工具：${name}`)
  return handler((input ?? {}) as Record<string, unknown>)
}

export function parseActionPreview(input: unknown): ActionPreview | null {
  const i = (input ?? {}) as Record<string, unknown>
  if (typeof i.title !== 'string' || !Array.isArray(i.items) || typeof i.impact !== 'string') return null
  return {
    actionType: typeof i.action_type === 'string' ? i.action_type : 'other',
    title: i.title.slice(0, 120),
    items: i.items.filter((x): x is string => typeof x === 'string').slice(0, 50).map((x) => x.slice(0, 200)),
    impact: i.impact.slice(0, 500),
  }
}

export { money }
