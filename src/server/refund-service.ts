import 'server-only'
import { applyPoints } from './points-ledger'
import { Prisma, RegistrationStatus } from '@prisma/client'
import { isDemoTenant, prisma } from '@/lib/db'
import { getPaymentProvider } from '@/lib/payments'
import { formatDateTime, now } from '@/lib/time'
import { notifySeatWatchers } from './activity-service'

/**
 * 逐項退款。
 *
 * 金額一律由後端計算：
 *   每個項目分攤到的「實付金額」與「點數」= 訂單實付／點數 × 項目原價 ÷ 原價合計（餘數給最後一項），
 *   折價券折扣因此按比例分攤；可退 = 分攤額 − 已退。原價不等於可退金額。
 *
 * 防重複：
 *   - idempotencyKey（確認畫面產生）唯一，連點或重送只會得到同一筆退款。
 *   - 交易內先寫入訂單取得寫入鎖，再重算可退金額並預留，並行請求看得到彼此的預留。
 *   - 送出前會比對確認畫面看到的金額，資料已變動就要求重新確認。
 *
 * 退回方式：
 *   ORIGINAL 原付款方式：呼叫金流退款，成功才完成；失敗則釋放預留、不取消預約。
 *   POINTS   點數：實付金額改以點數回補，立即完成。
 *   MANUAL   人工：金流不支援時使用，狀態為「待人工處理」，由人員完成後標記。
 * 取消預約（釋放時段／名額）是另一個選項，與退款分開勾選；ORIGINAL 只在退款成功後才取消。
 */

const TX = { maxWait: 15_000, timeout: 30_000 }

export class RefundError extends Error {}

export type RefundMethod = 'ORIGINAL' | 'POINTS' | 'MANUAL'

export interface RefundableItem {
  itemType: 'COURT' | 'ACTIVITY'
  itemId: string
  label: string
  detail: string
  gross: number
  cashShare: number
  pointsShare: number
  refundedCash: number
  refundedPoints: number
  refundableCash: number
  refundablePoints: number
  /** 項目是否仍有效（未取消） */
  active: boolean
  /** 不能退的原因 */
  blocked: string | null
}

export interface RefundOptions {
  bookingId: string
  code: string
  paidCash: number
  pointsUsed: number
  discount: number
  items: RefundableItem[]
  methods: { method: RefundMethod; label: string; available: boolean; note: string }[]
  /** 原付款金流，mock／internal 代表非真實款項 */
  provider: string | null
  simulated: boolean
  note: string | null
}

function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || total <= 0) return weights.map(() => 0)
  const out = weights.map((w) => Math.floor((total * w) / sum))
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
  return out
}

type Db = Prisma.TransactionClient | typeof prisma

async function loadBooking(db: Db, bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: { orderBy: { startsAt: 'asc' } },
      activityItems: { orderBy: { startsAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      refunds: true,
    },
  })
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>

function computeItems(b: LoadedBooking): { items: RefundableItem[]; paidCash: number } {
  const paid = b.payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
  const paidCash = paid ? b.total : 0
  const legacySettled = b.status === 'CANCELLED' && b.refunds.length === 0
  const lines = [
    ...b.items.map((it) => ({
      itemType: 'COURT' as const,
      itemId: it.id,
      label: `場地 ${it.courtName}`,
      detail: formatDateTime(it.startsAt) + ` ${it.rateName}`,
      gross: it.price,
      refundedCash: it.refundedAmount,
      refundedPoints: it.refundedPoints,
      active: it.status === 'ACTIVE',
    })),
    ...b.activityItems.map((it) => ({
      itemType: 'ACTIVITY' as const,
      itemId: it.id,
      label: `活動 ${it.title}`,
      detail: `${formatDateTime(it.startsAt)}・${it.quantity} × NT$${it.unitPrice}`,
      gross: it.amount,
      refundedCash: it.refundedAmount,
      refundedPoints: it.refundedPoints,
      active: it.status === 'ACTIVE',
    })),
  ]
  const cash = allocate(paidCash, lines.map((l) => l.gross))
  const points = allocate(b.pointsUsed, lines.map((l) => l.gross))
  const items = lines.map((l, i) => {
    const refundableCash = Math.max(0, cash[i] - l.refundedCash)
    const refundablePoints = Math.max(0, points[i] - l.refundedPoints)
    let blocked: string | null = null
    if (legacySettled) blocked = '此訂單已依舊制取消，退款已以點數回補'
    else if (b.status === 'PENDING' || b.status === 'EXPIRED') blocked = '訂單尚未付款，沒有可退款項'
    else if (refundableCash === 0 && refundablePoints === 0) blocked = '已全數退款'
    return { ...l, cashShare: cash[i], pointsShare: points[i], refundableCash, refundablePoints, blocked }
  })
  return { items, paidCash }
}

/** 退款選項：每項可退金額與可用的退回方式 */
export async function getRefundOptions(bookingId: string): Promise<RefundOptions> {
  const b = await loadBooking(prisma, bookingId)
  if (!b) throw new RefundError('找不到訂單')
  const { items, paidCash } = computeItems(b)
  const pay = b.payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
  const demo = await isDemoTenant()
  const providerId = pay?.provider ?? null
  const provider = providerId && providerId !== 'internal' ? getPaymentProvider(providerId) : null
  const simulated = demo || providerId === 'mock'
  const originalAvailable = Boolean(provider?.refund && pay?.providerRef)

  return {
    bookingId: b.id,
    code: b.code,
    paidCash,
    pointsUsed: b.pointsUsed,
    discount: b.discount,
    items,
    provider: providerId,
    simulated,
    methods: [
      {
        method: 'ORIGINAL',
        label: '原付款方式退回',
        available: originalAvailable,
        note: originalAvailable
          ? simulated
            ? '模擬金流：只會產生模擬結果，不會退真實款項'
            : `透過 ${provider?.displayName ?? providerId} 退款，成功後才完成`
          : providerId === 'internal'
            ? '這筆訂單以點數／折價券全額折抵，沒有金流款項'
            : '原金流不支援線上退款，請改用人工處理或點數',
      },
      { method: 'POINTS', label: '退為會員點數', available: true, note: '實付金額改以點數（1 點＝NT$1）回補，立即完成' },
      { method: 'MANUAL', label: '人工退款', available: paidCash > 0, note: '由人員以匯款等方式處理，系統記錄為「待人工處理」，完成後再標記' },
    ],
    note: b.status === 'REFUND_PENDING' ? '此訂單付款時名額或時段已失效（款項待退）' : null,
  }
}

export interface RefundRequest {
  bookingId: string
  itemIds: string[]
  method: RefundMethod
  cancelItems: boolean
  reason: string
  idempotencyKey: string
  /** 確認畫面看到的金額，送出時重新核對 */
  expectedCash: number
  expectedPoints: number
  actor: string
}

export interface RefundResultView {
  id: string
  status: string
  method: string
  cashAmount: number
  pointsAmount: number
  simulated: boolean
  failReason: string | null
  duplicate: boolean
}

/** 執行退款（可安全重送：同一 idempotencyKey 只會處理一次） */
export async function executeRefund(req: RefundRequest): Promise<RefundResultView> {
  if (!req.reason.trim()) throw new RefundError('請填寫退款原因')
  if (req.itemIds.length === 0) throw new RefundError('請選擇要退款的項目')
  if (!/^[\w-]{8,80}$/.test(req.idempotencyKey)) throw new RefundError('操作識別碼無效，請重新開啟確認畫面')

  const existing = await prisma.refund.findUnique({ where: { idempotencyKey: req.idempotencyKey } })
  if (existing) return view(existing, true)

  const demo = await isDemoTenant()

  // 1. 預留金額（交易內重算）
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: req.bookingId }, data: { updatedAt: now() } }) // 取得寫入鎖
    const again = await tx.refund.findUnique({ where: { idempotencyKey: req.idempotencyKey } })
    if (again) return { refund: again, duplicate: true }

    const b = await loadBooking(tx, req.bookingId)
    if (!b) throw new RefundError('找不到訂單')
    const { items } = computeItems(b)
    const picked = items.filter((i) => req.itemIds.includes(i.itemId))
    if (picked.length !== req.itemIds.length) throw new RefundError('部分項目不屬於這張訂單')
    const blocked = picked.find((i) => i.blocked)
    if (blocked) throw new RefundError(`${blocked.label}：${blocked.blocked}`)

    const cash = picked.reduce((s, i) => s + i.refundableCash, 0)
    const points = picked.reduce((s, i) => s + i.refundablePoints, 0)
    if (cash !== req.expectedCash || points !== req.expectedPoints) {
      throw new RefundError('可退金額已變動（可能有其他人剛處理過），請重新開啟退款確認')
    }
    const pay = b.payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
    if (req.method === 'ORIGINAL' && (!pay?.providerRef || pay.provider === 'internal')) {
      throw new RefundError('這筆訂單無法原路退款，請改用點數或人工處理')
    }
    if (req.method === 'MANUAL' && cash === 0) throw new RefundError('沒有需要人工退回的實付金額')

    const status = req.method === 'ORIGINAL' ? 'PROCESSING' : req.method === 'MANUAL' ? 'MANUAL_PENDING' : 'SUCCEEDED'
    const refund = await tx.refund.create({
      data: {
        bookingId: b.id,
        idempotencyKey: req.idempotencyKey,
        status,
        method: req.method,
        cashAmount: cash,
        pointsAmount: points,
        reason: req.reason.trim().slice(0, 300),
        cancelItems: req.cancelItems,
        provider: demo ? 'demo-simulator' : (pay?.provider ?? null),
        providerRef: null,
        createdBy: req.actor,
        completedAt: status === 'SUCCEEDED' ? now() : null,
        items: {
          create: picked.map((i) => ({
            itemType: i.itemType,
            itemId: i.itemId,
            label: `${i.label} ${i.detail}`,
            cashAmount: i.refundableCash,
            pointsAmount: i.refundablePoints,
          })),
        },
      },
    })
    // 預留：先記入已退，並行的退款會看到
    for (const i of picked) {
      const data = { refundedAmount: { increment: i.refundableCash }, refundedPoints: { increment: i.refundablePoints } }
      if (i.itemType === 'COURT') await tx.bookingItem.update({ where: { id: i.itemId }, data })
      else await tx.bookingActivityItem.update({ where: { id: i.itemId }, data })
    }
    await tx.booking.update({ where: { id: b.id }, data: { refundedAmount: { increment: cash } } })

    // 點數與人工：立即回補點數並（若勾選）取消預約
    if (req.method !== 'ORIGINAL') {
      const credit = points + (req.method === 'POINTS' ? cash : 0)
      if (credit > 0) await applyPoints(tx, { userId: b.userId, delta: credit, kind: 'REFUND', reason: `訂單 ${b.code} 退款回補`, actor: req.actor, idempotencyKey: `refund:${req.idempotencyKey}:points`, bookingId: b.id })
      if (req.cancelItems) await cancelPicked(tx, b, picked)
    }
    await tx.auditLog.create({
      data: {
        actor: req.actor,
        action: 'REFUND_REQUEST',
        target: b.code,
        detail: { refundId: refund.id, method: req.method, cash, points, items: picked.map((i) => i.label), cancelItems: req.cancelItems },
      },
    })
    await syncRefundStatus(tx, b.id)
    return { refund, duplicate: false }
  }, TX)

  if (reserved.duplicate || req.method !== 'ORIGINAL') {
    if (req.cancelItems && !reserved.duplicate) await notifyReleased(req.bookingId)
    return view(reserved.refund, reserved.duplicate)
  }

  // 2. 原路退款：呼叫金流，收到結果才決定成功或失敗
  const r = reserved.refund
  let ok = false
  let providerRef: string | null = null
  let failReason: string | null = null
  if (demo) {
    ok = true
    providerRef = `SIM-REFUND-${r.id.slice(-8)}`
  } else {
    const booking = await prisma.booking.findUnique({ where: { id: req.bookingId }, include: { payments: true } })
    const pay = booking?.payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
    const provider = pay ? getPaymentProvider(pay.provider) : null
    try {
      if (!provider?.refund || !pay?.providerRef) throw new Error('金流不支援退款')
      const res = await provider.refund(pay.providerRef, r.cashAmount)
      ok = res.ok
      providerRef = res.providerRef ?? null
      if (!res.ok) failReason = res.failReason ?? '金流拒絕退款'
    } catch (err) {
      failReason = err instanceof Error ? err.message.slice(0, 300) : '金流退款失敗'
    }
  }

  const finished = await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: req.bookingId }, data: { updatedAt: now() } })
    const b = await loadBooking(tx, req.bookingId)
    if (!b) throw new RefundError('找不到訂單')
    const items = await tx.refundItem.findMany({ where: { refundId: r.id } })
    if (ok) {
      if (r.pointsAmount > 0) await applyPoints(tx, { userId: b.userId, delta: r.pointsAmount, kind: 'REFUND', reason: `訂單 ${b.code} 退款（點數部分）回補`, actor: req.actor, idempotencyKey: `refund:${r.id}:points-ok`, bookingId: b.id })
      if (r.cancelItems) {
        const { items: all } = computeItems(b)
        await cancelPicked(tx, b, all.filter((i) => items.some((x) => x.itemId === i.itemId)))
      }
      const updated = await tx.refund.update({ where: { id: r.id }, data: { status: 'SUCCEEDED', providerRef, completedAt: now() } })
      await tx.auditLog.create({ data: { actor: req.actor, action: 'REFUND_SUCCEEDED', target: b.code, detail: { refundId: r.id, providerRef, simulated: demo } } })
      await syncRefundStatus(tx, b.id)
      return updated
    }
    // 失敗：釋放預留，預約不動
    for (const it of items) {
      const data = { refundedAmount: { decrement: it.cashAmount }, refundedPoints: { decrement: it.pointsAmount } }
      if (it.itemType === 'COURT') await tx.bookingItem.update({ where: { id: it.itemId }, data })
      else await tx.bookingActivityItem.update({ where: { id: it.itemId }, data })
    }
    await tx.booking.update({ where: { id: b.id }, data: { refundedAmount: { decrement: r.cashAmount } } })
    const updated = await tx.refund.update({ where: { id: r.id }, data: { status: 'FAILED', failReason, completedAt: now() } })
    await tx.auditLog.create({ data: { actor: req.actor, action: 'REFUND_FAILED', target: b.code, detail: { refundId: r.id, failReason } } })
    await syncRefundStatus(tx, b.id)
    return updated
  }, TX)

  if (ok && r.cancelItems) await notifyReleased(req.bookingId)
  return view(finished, false)
}

/** 人工退款完成後標記 */
export async function markManualRefundDone(refundId: string, note: string, actor: string) {
  const r = await prisma.refund.findUnique({ where: { id: refundId }, include: { booking: true } })
  if (!r) throw new RefundError('找不到退款紀錄')
  if (r.status !== 'MANUAL_PENDING') throw new RefundError('只有「待人工處理」的退款可以標記完成')
  if (!note.trim()) throw new RefundError('請填寫處理說明（例如匯款日期與帳號末五碼）')
  await prisma.$transaction(async (tx) => {
    const claim = await tx.refund.updateMany({ where: { id: refundId, status: 'MANUAL_PENDING' }, data: { status: 'MANUAL_DONE', note: note.trim().slice(0, 300), completedAt: now() } })
    if (claim.count === 0) throw new RefundError('這筆退款已被處理')
    await tx.auditLog.create({ data: { actor, action: 'REFUND_MANUAL_DONE', target: r.booking.code, detail: { refundId, note } } })
    await syncRefundStatus(tx, r.bookingId)
  }, TX)
}

async function cancelPicked(tx: Prisma.TransactionClient, b: LoadedBooking, picked: { itemType: string; itemId: string }[]) {
  for (const p of picked) {
    if (p.itemType === 'COURT') {
      const it = b.items.find((x) => x.id === p.itemId)
      if (!it || it.status !== 'ACTIVE') continue
      await tx.bookingItem.update({ where: { id: it.id }, data: { status: 'CANCELLED' } })
      await tx.reservation.deleteMany({ where: { bookingId: b.id, courtId: it.courtId, startsAt: it.startsAt } })
    } else {
      const it = b.activityItems.find((x) => x.id === p.itemId)
      if (!it || it.status !== 'ACTIVE') continue
      await tx.bookingActivityItem.update({ where: { id: it.id }, data: { status: 'CANCELLED' } })
      await tx.sessionRegistration.updateMany({
        where: { id: it.registrationId, status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] } },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now(), holdExpiresAt: null },
      })
    }
  }
  const remaining =
    (await tx.bookingItem.count({ where: { bookingId: b.id, status: 'ACTIVE' } })) +
    (await tx.bookingActivityItem.count({ where: { bookingId: b.id, status: 'ACTIVE' } }))
  if (remaining === 0 && b.status !== 'CANCELLED') {
    await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: now() } })
  }
}

async function notifyReleased(bookingId: string) {
  const items = await prisma.bookingActivityItem.findMany({ where: { bookingId }, select: { sessionId: true } })
  await notifySeatWatchers(items.map((i) => i.sessionId)).catch(() => {})
}

/** 依退款紀錄重算訂單的退款狀態 */
export async function syncRefundStatus(tx: Prisma.TransactionClient, bookingId: string) {
  const b = await tx.booking.findUnique({ where: { id: bookingId }, include: { refunds: true, payments: true } })
  if (!b) return
  const paid = b.payments.some((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED') ? b.total : 0
  const done = b.refunds.filter((r) => r.status === 'SUCCEEDED' || r.status === 'MANUAL_DONE')
  const doneCash = done.reduce((s, r) => s + r.cashAmount, 0)
  const donePoints = done.reduce((s, r) => s + r.pointsAmount, 0)
  let status = 'NONE'
  if (b.refunds.some((r) => r.status === 'PROCESSING')) status = 'PROCESSING'
  else if (b.refunds.some((r) => r.status === 'MANUAL_PENDING')) status = 'MANUAL'
  else if (done.length > 0) status = doneCash >= paid && donePoints >= b.pointsUsed ? 'FULL' : 'PARTIAL'
  else if (b.refunds.some((r) => r.status === 'FAILED')) status = 'FAILED'
  await tx.booking.update({ where: { id: bookingId }, data: { refundStatus: status } })
}

function view(r: { id: string; status: string; method: string; cashAmount: number; pointsAmount: number; provider: string | null; failReason: string | null }, duplicate: boolean): RefundResultView {
  return {
    id: r.id,
    status: r.status,
    method: r.method,
    cashAmount: r.cashAmount,
    pointsAmount: r.pointsAmount,
    simulated: r.provider === 'demo-simulator' || r.provider === 'mock',
    failReason: r.failReason,
    duplicate,
  }
}
