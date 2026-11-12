import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, taipeiDateString } from '@/lib/time'

/**
 * 財務與營運指標的唯一計算來源。訂單與財務、營運總覽、收入與退款頁一律呼叫這裡，
 * 同一個指標在不同頁面必定得到同一個數字。
 *
 * 定義：
 * - 實收：付款成功的金額（Payment 狀態 SUCCESS／REFUNDED），依付款時間歸屬。之後退款不會改變當時的實收。
 * - 退款：已完成的退款（Refund 狀態 SUCCEEDED／MANUAL_DONE），依完成時間歸屬；現金與點數分開。
 * - 淨實收 = 實收 − 現金退款。
 * - 儲值實收：儲值單付款成功的金額（PAID／CREDITED／CREDIT_FAILED），依付款時間；與訂場實收分開列。
 * - 成立訂單：付款成功的訂單數，依付款時間。
 * - 核准費用：狀態 APPROVED 的費用，依申請時間。
 */

export const COLLECTED_PAYMENT_STATUSES = ['SUCCESS', 'REFUNDED'] as const
export const DONE_REFUND_STATUSES = ['SUCCEEDED', 'MANUAL_DONE'] as const
export const OPEN_REFUND_STATUSES = ['ACTIVE', 'MANUAL_PENDING', 'FAILED'] as const
export const COLLECTED_TOPUP_STATUSES = ['PAID', 'CREDITED', 'CREDIT_FAILED'] as const

export const METRIC_BASIS = {
  collected: '付款成功金額，依付款時間',
  refunded: '已完成退款的現金，依完成時間',
  net: '實收 − 現金退款',
  topup: '儲值付款成功金額，依付款時間',
  orders: '付款成功的訂單數，依付款時間',
  expenses: '已核准費用，依申請時間',
} as const

export interface Range {
  fromUtc: Date
  toUtc: Date
}

export async function financeTotals(r: Range) {
  const [pay, ref, top, orders, exp] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: [...COLLECTED_PAYMENT_STATUSES] }, paidAt: { gte: r.fromUtc, lt: r.toUtc } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.refund.aggregate({
      where: { status: { in: [...DONE_REFUND_STATUSES] }, completedAt: { gte: r.fromUtc, lt: r.toUtc } },
      _sum: { cashAmount: true, pointsAmount: true },
      _count: { _all: true },
    }),
    prisma.topUpOrder.aggregate({
      where: { status: { in: [...COLLECTED_TOPUP_STATUSES] }, paidAt: { gte: r.fromUtc, lt: r.toUtc } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.booking.count({ where: { paidAt: { gte: r.fromUtc, lt: r.toUtc } } }),
    prisma.expense.aggregate({ where: { status: 'APPROVED', submittedAt: { gte: r.fromUtc, lt: r.toUtc } }, _sum: { amount: true } }),
  ])
  const collected = pay._sum.amount ?? 0
  const refunded = ref._sum.cashAmount ?? 0
  return {
    collected,
    paymentCount: pay._count._all,
    refunded,
    refundedPoints: ref._sum.pointsAmount ?? 0,
    refundCount: ref._count._all,
    net: collected - refunded,
    topup: top._sum.amount ?? 0,
    topupCount: top._count._all,
    orders,
    expenses: exp._sum.amount ?? 0,
  }
}

export type FinanceTotals = Awaited<ReturnType<typeof financeTotals>>

/** 期間內有實收的訂單（含之後取消、退款者），明細加總等於實收；供營收明細與 AI 分析使用 */
export async function collectedBookings(r: Range, take = 2000) {
  return prisma.booking.findMany({
    where: { paidAt: { gte: r.fromUtc, lt: r.toUtc }, payments: { some: { status: { in: [...COLLECTED_PAYMENT_STATUSES] } } } },
    orderBy: { paidAt: 'desc' },
    take,
    include: {
      items: { select: { id: true, courtId: true, courtName: true, price: true } },
      activityItems: { select: { id: true, title: true, amount: true } },
      payments: { where: { status: { in: [...COLLECTED_PAYMENT_STATUSES] } }, select: { method: true, amount: true } },
    },
  })
}

export interface RevenueLine {
  id: string
  type: 'COURT' | 'EVENT'
  courtId?: string
  label: string
  amount: number
}

/**
 * 把一張訂單的實收按明細原價比例分攤到場地與活動；
 * 沒有任何明細（例如時段已釋放的待退款訂單）時列一行「無明細」，確保分攤加總永遠等於實收。
 */
export function allocateCollected(b: Awaited<ReturnType<typeof collectedBookings>>[number]): RevenueLine[] {
  const total = collectedOf(b)
  const base = [
    ...b.items.map((i) => ({ id: i.id, type: 'COURT' as const, courtId: i.courtId, label: i.courtName, weight: i.price })),
    ...b.activityItems.map((i) => ({ id: i.id, type: 'EVENT' as const, courtId: undefined, label: i.title, weight: i.amount })),
  ]
  if (base.length === 0) return [{ id: b.id, type: 'COURT', label: '無明細（時段已釋放）', amount: total }]
  const sum = base.reduce((s, x) => s + x.weight, 0)
  let allocated = 0
  return base.map((x, idx) => {
    const amount = idx === base.length - 1 ? total - allocated : Math.round(sum > 0 ? (total * x.weight) / sum : total / base.length)
    allocated += amount
    return { id: x.id, type: x.type, courtId: x.courtId, label: x.label, amount }
  })
}

/** 一張訂單的實收金額（成功付款加總） */
export const collectedOf = (b: { payments: { amount: number }[] }) => b.payments.reduce((s, p) => s + p.amount, 0)

/** 逐日實收、退款、成立訂單（台北日期） */
export async function dailySeries(fromDate: string, toDate: string, r: Range) {
  const [payments, refunds, bookings] = await Promise.all([
    prisma.payment.findMany({ where: { status: { in: [...COLLECTED_PAYMENT_STATUSES] }, paidAt: { gte: r.fromUtc, lt: r.toUtc } }, select: { amount: true, paidAt: true } }),
    prisma.refund.findMany({ where: { status: { in: [...DONE_REFUND_STATUSES] }, completedAt: { gte: r.fromUtc, lt: r.toUtc } }, select: { cashAmount: true, completedAt: true } }),
    prisma.booking.findMany({ where: { paidAt: { gte: r.fromUtc, lt: r.toUtc } }, select: { paidAt: true } }),
  ])
  const days: string[] = []
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) days.push(d)
  const row = new Map(days.map((d) => [d, { date: d, collected: 0, refunded: 0, orders: 0 }]))
  for (const p of payments) if (p.paidAt) row.get(taipeiDateString(p.paidAt))!.collected += p.amount
  for (const x of refunds) if (x.completedAt) row.get(taipeiDateString(x.completedAt))!.refunded += x.cashAmount
  for (const b of bookings) if (b.paidAt) row.get(taipeiDateString(b.paidAt))!.orders += 1
  return days.map((d) => row.get(d)!)
}

/** 各場地收益：期間實收按明細分攤（與收入與退款分析的「依球場」同一算法，加總等於實收） */
export async function revenueByCourt(r: Range) {
  const sums = new Map<string, { court: string; amount: number; slots: number }>()
  for (const b of await collectedBookings(r)) {
    for (const line of allocateCollected(b)) {
      const s = sums.get(line.label) ?? { court: line.label, amount: 0, slots: 0 }
      s.amount += line.amount
      if (line.type === 'COURT' && line.courtId) s.slots += 1
      sums.set(line.label, s)
    }
  }
  return [...sums.values()].sort((a, b) => b.amount - a.amount)
}

/** 異常事件統計（場地監測回報的 Incident） */
export async function incidentStats(r: Range) {
  const [inPeriod, open] = await Promise.all([
    prisma.incident.groupBy({ by: ['type'], where: { createdAt: { gte: r.fromUtc, lt: r.toUtc } }, _count: { _all: true } }),
    prisma.incident.count({ where: { status: { not: 'RESOLVED' } } }),
  ])
  return { byType: inPeriod.map((x) => ({ type: x.type, count: x._count._all })).sort((a, b) => b.count - a.count), open }
}
