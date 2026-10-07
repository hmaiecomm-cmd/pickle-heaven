import 'server-only'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { isDemoTenant, prisma } from '@/lib/db'
import { activityTimeLabel } from '@/lib/activity-shared'
import { addDays, formatRange, isValidDateString, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { getRefundOptions } from './refund-service'
import { invoiceIntegration } from './invoice-service'

/**
 * 交易管理：訂場與活動訂單的搜尋、列表、明細。
 * 付款、訂單、退款、發票四種狀態分開計算與篩選，不混成單一欄位。
 */

export const PAYMENT_STATUS = { PENDING: '待付款', PAID: '已付款', FAILED: '付款失敗', UNPAID: '未付款' } as const
export const ORDER_STATUS = { ACTIVE: '有效', CANCELLED: '已取消', EXPIRED: '已過期', COMPLETED: '已完成', REFUND_PENDING: '款項待退' } as const
export const REFUND_STATUS = { NONE: '無退款', PROCESSING: '處理中', PARTIAL: '部分退款', FULL: '全額退款', FAILED: '退款失敗', MANUAL: '待人工退款' } as const
export const INVOICE_STATUS = {
  NONE: '未開立',
  INTERNAL: '內部紀錄（未串接電子發票）',
  ISSUING: '開立中',
  ISSUED: '已開立',
  MODIFYING: '異動中',
  MODIFY_FAILED: '異動失敗',
  VOIDED: '已作廢',
} as const

export const orderQuerySchema = z.object({
  q: z.string().trim().max(60).optional().default(''),
  dateType: z.enum(['created', 'play', 'paid']).default('play'),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  courtId: z.string().optional().default(''),
  type: z.enum(['all', 'court', 'activity', 'mixed']).default('all'),
  payment: z.enum(['', 'PENDING', 'PAID', 'FAILED', 'UNPAID']).default(''),
  order: z.enum(['', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'REFUND_PENDING']).default(''),
  refund: z.enum(['', 'NONE', 'PROCESSING', 'PARTIAL', 'FULL', 'FAILED', 'MANUAL']).default(''),
  invoice: z.enum(['', 'NONE', 'HAS']).default(''),
  sort: z.enum(['created_desc', 'created_asc', 'play_desc', 'play_asc', 'total_desc', 'total_asc']).default('created_desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
})

export type OrderQuery = z.infer<typeof orderQuerySchema>

const PAID_STATES = ['PAID', 'COMPLETED', 'REFUND_PENDING'] as const

function paymentWhere(p: OrderQuery['payment']): Prisma.BookingWhereInput | null {
  const success = { payments: { some: { status: { in: ['SUCCESS', 'REFUNDED'] as ('SUCCESS' | 'REFUNDED')[] } } } }
  switch (p) {
    case 'PENDING':
      return { status: 'PENDING', payments: { none: { status: 'FAILED' } } }
    case 'PAID':
      return { OR: [{ status: { in: [...PAID_STATES] } }, { status: 'CANCELLED', ...success }] }
    case 'FAILED':
      return { status: { in: ['PENDING', 'EXPIRED'] }, payments: { some: { status: 'FAILED' } } }
    case 'UNPAID':
      return { status: { in: ['EXPIRED', 'CANCELLED'] }, payments: { none: { status: { in: ['SUCCESS', 'REFUNDED'] } } } }
    default:
      return null
  }
}

function orderWhere(o: OrderQuery['order']): Prisma.BookingWhereInput | null {
  switch (o) {
    case 'ACTIVE':
      return { status: { in: ['PENDING', 'PAID'] } }
    case 'CANCELLED':
    case 'EXPIRED':
    case 'COMPLETED':
    case 'REFUND_PENDING':
      return { status: o }
    default:
      return null
  }
}

export function buildWhere(q: OrderQuery): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = []
  const text = q.q.trim()
  if (text) {
    const digits = text.replace(/[^\d]/g, '')
    const or: Prisma.BookingWhereInput[] = [
      { code: { contains: text.toUpperCase() } },
      { contactName: { contains: text } },
      { user: { displayName: { contains: text } } },
      { user: { email: { contains: text.toLowerCase() } } },
    ]
    if (digits.length >= 3) {
      or.push({ contactPhone: { contains: digits } }, { user: { phone: { contains: digits } } })
    }
    and.push({ OR: or })
  }
  const from = isValidDateString(q.from) ? q.from : null
  const to = isValidDateString(q.to) ? q.to : null
  if (from || to) {
    if (q.dateType === 'play') {
      and.push({ playDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
    } else {
      const range = { ...(from ? { gte: taipeiToUtc(from, 0) } : {}), ...(to ? { lt: taipeiToUtc(addDays(to, 1), 0) } : {}) }
      and.push(q.dateType === 'created' ? { createdAt: range } : { paidAt: range })
    }
  }
  if (q.courtId) {
    and.push({ OR: [{ items: { some: { courtId: q.courtId } } }, { activityItems: { some: { session: { courts: { some: { courtId: q.courtId } } } } } }] })
  }
  if (q.type === 'court') and.push({ items: { some: {} }, activityItems: { none: {} } })
  if (q.type === 'activity') and.push({ activityItems: { some: {} }, items: { none: {} } })
  if (q.type === 'mixed') and.push({ items: { some: {} }, activityItems: { some: {} } })
  const pw = paymentWhere(q.payment)
  if (pw) and.push(pw)
  const ow = orderWhere(q.order)
  if (ow) and.push(ow)
  if (q.refund) and.push({ refundStatus: q.refund })
  if (q.invoice === 'NONE') and.push({ invoices: { none: {} } })
  if (q.invoice === 'HAS') and.push({ invoices: { some: {} } })
  return and.length ? { AND: and } : {}
}

const ORDER_BY: Record<OrderQuery['sort'], Prisma.BookingOrderByWithRelationInput[]> = {
  created_desc: [{ createdAt: 'desc' }],
  created_asc: [{ createdAt: 'asc' }],
  play_desc: [{ playDate: 'desc' }, { createdAt: 'desc' }],
  play_asc: [{ playDate: 'asc' }, { createdAt: 'asc' }],
  total_desc: [{ total: 'desc' }],
  total_asc: [{ total: 'asc' }],
}

/** 電話遮罩：0912***678 */
export function maskPhone(p: string | null | undefined): string {
  if (!p) return ''
  const d = p.replace(/[^\d]/g, '')
  return d.length >= 7 ? `${d.slice(0, 4)}***${d.slice(-3)}` : '***'
}
/** Email 遮罩：ab***@example.com */
export function maskEmail(e: string | null | undefined): string {
  if (!e || !e.includes('@')) return ''
  const [u, d] = e.split('@')
  return `${u.slice(0, 2)}***@${d}`
}

type Row = Prisma.BookingGetPayload<{
  include: {
    user: { select: { id: true; displayName: true; email: true; phone: true } }
    items: { select: { courtName: true; startsAt: true; endsAt: true; status: true } }
    activityItems: { select: { title: true; quantity: true; status: true } }
    payments: { select: { status: true; provider: true } }
    invoices: { select: { status: true; providerStatus: true } }
  }
}>

export function paymentStatusOf(b: Pick<Row, 'status' | 'payments'>): keyof typeof PAYMENT_STATUS {
  const success = b.payments.some((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
  if (success || (PAID_STATES as readonly string[]).includes(b.status)) return 'PAID'
  if (b.payments.some((p) => p.status === 'FAILED')) return 'FAILED'
  if (b.status === 'PENDING') return 'PENDING'
  return 'UNPAID'
}

export function orderStatusOf(status: string): keyof typeof ORDER_STATUS {
  if (status === 'PENDING' || status === 'PAID') return 'ACTIVE'
  return status as keyof typeof ORDER_STATUS
}

export function invoiceStatusOf(invoices: { status: string; providerStatus: string | null }[]): keyof typeof INVOICE_STATUS {
  const live = invoices.filter((i) => i.providerStatus !== 'VOIDED')
  const inv = live[live.length - 1] ?? invoices[invoices.length - 1]
  if (!inv) return 'NONE'
  if (inv.providerStatus) return inv.providerStatus as keyof typeof INVOICE_STATUS
  return 'INTERNAL'
}

export async function listOrders(raw: unknown) {
  const q = orderQuerySchema.parse(raw ?? {})
  const where = buildWhere(q)
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: ORDER_BY[q.sort],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        user: { select: { id: true, displayName: true, email: true, phone: true } },
        items: { select: { courtName: true, startsAt: true, endsAt: true, status: true }, orderBy: { startsAt: 'asc' } },
        activityItems: { select: { title: true, quantity: true, status: true } },
        payments: { select: { status: true, provider: true } },
        invoices: { select: { status: true, providerStatus: true }, orderBy: { createdAt: 'asc' } },
      },
    }),
  ])
  return {
    query: q,
    total,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    queriedAt: new Date().toISOString(),
    /** true = 呼叫者沒有財務權限，金額欄位已在伺服器端清為 0 */
    amountsHidden: false,
    rows: rows.map((b) => {
      const courts = b.items.length
      const acts = b.activityItems.length
      const summary = [
        courts ? `場地 ${courts} 時段（${[...new Set(b.items.map((i) => i.courtName))].join('、')}）` : '',
        acts ? `活動：${b.activityItems.map((a) => `${a.title}×${a.quantity}`).join('、')}` : '',
      ]
        .filter(Boolean)
        .join('；')
      return {
        id: b.id,
        code: b.code,
        customer: {
          name: b.contactName || b.user.displayName,
          lineName: b.user.displayName,
          phone: maskPhone(b.contactPhone || b.user.phone),
          email: maskEmail(b.user.email),
          memberRef: b.user.id.slice(-6),
        },
        summary,
        type: courts && acts ? 'mixed' : acts ? 'activity' : 'court',
        playDate: b.playDate,
        paymentStatus: paymentStatusOf(b),
        orderStatus: orderStatusOf(b.status),
        refundStatus: b.refundStatus as keyof typeof REFUND_STATUS,
        invoiceStatus: invoiceStatusOf(b.invoices),
        total: b.total,
        refundedAmount: b.refundedAmount,
        createdAt: b.createdAt.toISOString(),
        simulatedPayment: b.payments.some((p) => p.provider === 'mock'),
      }
    }),
  }
}

export type OrderListResult = Awaited<ReturnType<typeof listOrders>>

/** 訂單明細：客戶、項目、金額、付款、退款、發票、時間軸 */
export async function getOrderDetail(id: string) {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true,
      venue: { select: { name: true } },
      items: { orderBy: { startsAt: 'asc' } },
      activityItems: { orderBy: { startsAt: 'asc' }, include: { session: { select: { id: true, status: true } } } },
      payments: { orderBy: { createdAt: 'asc' } },
      refunds: { orderBy: { createdAt: 'asc' }, include: { items: true } },
      invoices: { orderBy: { createdAt: 'asc' }, include: { events: { orderBy: { createdAt: 'asc' } } } },
    },
  })
  if (!b) return null
  const [audits, refund, invoiceInteg] = await Promise.all([
    prisma.auditLog.findMany({ where: { target: b.code }, orderBy: { createdAt: 'asc' }, take: 100 }),
    getRefundOptions(b.id),
    invoiceIntegration(),
  ])
  const base = taipeiToUtc(b.playDate, 0).getTime()

  const timeline: { at: string; label: string; actor?: string }[] = [
    { at: b.createdAt.toISOString(), label: '建立訂單' },
    ...b.payments.map((p) => ({
      at: (p.paidAt ?? p.createdAt).toISOString(),
      label: p.status === 'SUCCESS' ? `付款成功（${p.provider}）` : p.status === 'FAILED' ? `付款失敗：${p.failReason ?? ''}` : `付款 ${p.status}`,
    })),
    ...b.refunds.map((r) => ({
      at: (r.completedAt ?? r.createdAt).toISOString(),
      label: `退款${{ PROCESSING: '處理中', SUCCEEDED: '成功', FAILED: '失敗', MANUAL_PENDING: '待人工處理', MANUAL_DONE: '人工完成' }[r.status] ?? r.status}：NT$${r.cashAmount}${r.pointsAmount ? `＋${r.pointsAmount} 點` : ''}`,
      actor: r.createdBy,
    })),
    ...b.invoices.flatMap((inv) =>
      inv.events.map((e) => ({ at: (e.completedAt ?? e.createdAt).toISOString(), label: `發票 ${inv.invoiceNumber} ${e.type === 'RESEND' ? '補寄' : '作廢重開'}：${e.status}${e.simulated ? '（模擬）' : ''}`, actor: e.createdBy })),
    ),
    ...audits
      .filter((a) => !a.action.startsWith('REFUND_'))
      .map((a) => ({ at: a.createdAt.toISOString(), label: a.action, actor: a.actor })),
    ...(b.cancelledAt ? [{ at: b.cancelledAt.toISOString(), label: '訂單取消' }] : []),
  ].sort((x, y) => x.at.localeCompare(y.at))

  return {
    id: b.id,
    code: b.code,
    venueName: b.venue.name,
    createdAt: b.createdAt.toISOString(),
    paidAt: b.paidAt?.toISOString() ?? null,
    playDate: b.playDate,
    status: b.status,
    paymentStatus: paymentStatusOf(b),
    orderStatus: orderStatusOf(b.status),
    refundStatus: b.refundStatus as keyof typeof REFUND_STATUS,
    invoiceStatus: invoiceStatusOf(b.invoices),
    customer: {
      userId: b.user.id,
      name: b.contactName,
      phone: b.contactPhone,
      lineName: b.user.displayName,
      email: b.user.email,
      memberPhone: b.user.phone,
      points: b.user.points,
    },
    note: b.note,
    amountsHidden: false,
    amounts: {
      subtotal: b.subtotal,
      discount: b.discount,
      voucherCode: b.voucherCode,
      pointsUsed: b.pointsUsed,
      total: b.total,
      refundedAmount: b.refundedAmount,
    },
    courtItems: b.items.map((it) => {
      const s = Math.round((it.startsAt.getTime() - base) / 60_000)
      const e = Math.round((it.endsAt.getTime() - base) / 60_000)
      return { id: it.id, courtName: it.courtName, date: taipeiDateString(it.startsAt), timeLabel: formatRange(s, e), rateName: it.rateName, price: it.price, status: it.status, refundedAmount: it.refundedAmount, refundedPoints: it.refundedPoints }
    }),
    activityItems: b.activityItems.map((it) => {
      const d = taipeiDateString(it.startsAt)
      const s = taipeiMinuteOfDay(it.startsAt)
      const e = s + Math.round((it.endsAt.getTime() - it.startsAt.getTime()) / 60_000)
      return { id: it.id, sessionId: it.sessionId, title: it.title, date: d, timeLabel: activityTimeLabel(s, e), courtNames: it.courtNames, quantity: it.quantity, unitPrice: it.unitPrice, amount: it.amount, status: it.status, sessionStatus: it.session.status, refundedAmount: it.refundedAmount, refundedPoints: it.refundedPoints }
    }),
    payments: b.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      method: p.method,
      amount: p.amount,
      status: p.status,
      providerRef: p.providerRef,
      card: p.cardLast4 ? `${p.cardBrand ?? ''} ****${p.cardLast4}` : null,
      at: (p.paidAt ?? p.createdAt).toISOString(),
      failReason: p.failReason,
      simulated: p.provider === 'mock',
    })),
    refunds: b.refunds.map((r) => ({
      id: r.id,
      status: r.status,
      method: r.method,
      cashAmount: r.cashAmount,
      pointsAmount: r.pointsAmount,
      reason: r.reason,
      cancelItems: r.cancelItems,
      provider: r.provider,
      providerRef: r.providerRef,
      failReason: r.failReason,
      note: r.note,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      simulated: r.provider === 'demo-simulator' || r.provider === 'mock',
      items: r.items.map((i) => ({ label: i.label, cashAmount: i.cashAmount, pointsAmount: i.pointsAmount })),
    })),
    invoices: b.invoices.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      amount: inv.amount,
      status: inv.status,
      providerStatus: inv.providerStatus,
      provider: inv.provider,
      recipientEmail: inv.recipientEmail ?? b.user.email,
      replacedById: inv.replacedById,
      issueDate: inv.issueDate.toISOString(),
      events: inv.events.map((e) => ({ id: e.id, type: e.type, status: e.status, simulated: e.simulated, reason: e.reason, error: e.error, at: e.createdAt.toISOString() })),
    })),
    refundOptions: refund,
    invoiceIntegration: invoiceInteg,
    timeline,
    demo: await isDemoTenant(),
  }
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>

/** 沒有財務權限時，在伺服器端移除金額（不把完整資料送到前端再隱藏） */
export function maskOrderListAmounts(r: OrderListResult): OrderListResult {
  return { ...r, amountsHidden: true, rows: r.rows.map((row) => ({ ...row, total: 0, refundedAmount: 0 })) }
}

export function maskOrderDetailAmounts(d: OrderDetail): OrderDetail {
  return {
    ...d,
    amountsHidden: true,
    customer: { ...d.customer, points: 0 },
    amounts: { ...d.amounts, subtotal: 0, discount: 0, pointsUsed: 0, total: 0, refundedAmount: 0 },
    courtItems: d.courtItems.map((i) => ({ ...i, price: 0, refundedAmount: 0, refundedPoints: 0 })),
    activityItems: d.activityItems.map((i) => ({ ...i, unitPrice: 0, amount: 0, refundedAmount: 0, refundedPoints: 0 })),
    payments: d.payments.map((p) => ({ ...p, amount: 0, card: null, providerRef: null })),
    refunds: d.refunds.map((r) => ({ ...r, cashAmount: 0, pointsAmount: 0 })),
    invoices: d.invoices.map((i) => ({ ...i, amount: 0 })),
  }
}
