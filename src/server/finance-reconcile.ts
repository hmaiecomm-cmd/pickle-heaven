import 'server-only'
import { prisma } from '@/lib/db'
import { addDays, taipeiToUtc } from '@/lib/time'
import { COLLECTED_PAYMENT_STATUSES, COLLECTED_TOPUP_STATUSES, DONE_REFUND_STATUSES, OPEN_REFUND_STATUSES, financeTotals } from './finance-metrics'

/** 日結：某一天（台北日期）的收款、退款與儲值，金額與營運總覽同一套算法 */
export async function dailyClose(date: string) {
  const range = { fromUtc: taipeiToUtc(date, 0), toUtc: taipeiToUtc(addDays(date, 1), 0) }
  const [totals, payments, refunds, topups] = await Promise.all([
    financeTotals(range),
    prisma.payment.findMany({
      where: { status: { in: [...COLLECTED_PAYMENT_STATUSES] }, paidAt: { gte: range.fromUtc, lt: range.toUtc } },
      select: { id: true, provider: true, method: true, amount: true, status: true, paidAt: true, booking: { select: { code: true } } },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.refund.findMany({
      where: { status: { in: [...DONE_REFUND_STATUSES] }, completedAt: { gte: range.fromUtc, lt: range.toUtc } },
      select: { id: true, method: true, cashAmount: true, pointsAmount: true, completedAt: true, booking: { select: { code: true } } },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.topUpOrder.findMany({
      where: { status: { in: [...COLLECTED_TOPUP_STATUSES] }, paidAt: { gte: range.fromUtc, lt: range.toUtc } },
      select: { id: true, amount: true, points: true, provider: true, method: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
  ])
  const byChannel = new Map<string, { channel: string; count: number; amount: number }>()
  for (const p of payments) {
    const key = `${p.provider}／${p.method}`
    const s = byChannel.get(key) ?? { channel: key, count: 0, amount: 0 }
    s.count += 1
    s.amount += p.amount
    byChannel.set(key, s)
  }
  return { totals, payments, refunds, topups, byChannel: [...byChannel.values()].sort((a, b) => b.amount - a.amount) }
}

export interface ReconcileIssue {
  bookingId: string
  code: string
  status: string
  amount: number
  detail: string
}

/** 對帳：目前所有尚未結清的問題（不限日期） */
export async function reconcileIssues() {
  const [refundPending, openRefunds, paidNoPayment, cancelledNotRefunded, recentPaid] = await Promise.all([
    prisma.booking.findMany({ where: { status: 'REFUND_PENDING' }, select: { id: true, code: true, status: true, total: true }, take: 200 }),
    prisma.refund.findMany({
      where: { status: { in: [...OPEN_REFUND_STATUSES] } },
      select: { id: true, status: true, cashAmount: true, pointsAmount: true, booking: { select: { id: true, code: true, status: true } } },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: { in: ['PAID', 'COMPLETED'] }, total: { gt: 0 }, payments: { none: { status: { in: [...COLLECTED_PAYMENT_STATUSES] } } } },
      select: { id: true, code: true, status: true, total: true },
      take: 200,
    }),
    prisma.booking.findMany({
      where: {
        status: 'CANCELLED',
        payments: { some: { status: 'SUCCESS' } },
        refunds: { none: { status: { in: [...DONE_REFUND_STATUSES, ...OPEN_REFUND_STATUSES] } } },
      },
      select: { id: true, code: true, status: true, total: true, refundedAmount: true },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      select: { id: true, code: true, status: true, total: true, payments: { where: { status: { in: [...COLLECTED_PAYMENT_STATUSES] } }, select: { amount: true } } },
      take: 2000,
    }),
  ])

  const mismatch = recentPaid
    .map((b) => ({ b, paid: b.payments.reduce((s, p) => s + p.amount, 0) }))
    .filter(({ b, paid }) => b.payments.length > 0 && paid !== b.total)

  const groups: { key: string; title: string; hint: string; items: ReconcileIssue[] }[] = [
    {
      key: 'refund-pending',
      title: '已付款但無法履約，待退款',
      hint: '逾時後才付款成功、時段或名額已失效的訂單，需要退款。',
      items: refundPending.map((b) => ({ bookingId: b.id, code: b.code, status: b.status, amount: b.total, detail: '待退款' })),
    },
    {
      key: 'open-refund',
      title: '退款尚未完成',
      hint: '退款處理中、待人工處理或退款失敗。',
      items: openRefunds.map((r) => ({
        bookingId: r.booking.id,
        code: r.booking.code,
        status: r.booking.status,
        amount: r.cashAmount,
        detail: `退款狀態 ${r.status}${r.pointsAmount ? `，另 ${r.pointsAmount} 點` : ''}`,
      })),
    },
    {
      key: 'cancelled-not-refunded',
      title: '已取消、有收款、沒有退款紀錄',
      hint: '請確認是否應退款，或屬於不退款的取消。',
      items: cancelledNotRefunded.map((b) => ({ bookingId: b.id, code: b.code, status: b.status, amount: b.total, detail: `已退 ${b.refundedAmount}` })),
    },
    {
      key: 'paid-no-payment',
      title: '訂單已付款，但找不到成功付款紀錄',
      hint: '可能是手動標記付款，或付款紀錄遺失。',
      items: paidNoPayment.map((b) => ({ bookingId: b.id, code: b.code, status: b.status, amount: b.total, detail: '無成功付款' })),
    },
    {
      key: 'amount-mismatch',
      title: '付款金額與訂單金額不符（近 90 天）',
      hint: '成功付款加總不等於訂單應付金額。',
      items: mismatch.map(({ b, paid }) => ({ bookingId: b.id, code: b.code, status: b.status, amount: b.total, detail: `實付 ${paid}` })),
    },
  ]
  return groups
}
