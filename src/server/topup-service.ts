import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { availableProviders } from '@/lib/payments'
import { now, taipeiDateString } from '@/lib/time'
import { assertNotRestricted, RestrictedError } from './member-restrictions'
import { applyPoints, PointsError } from './points-ledger'

/**
 * 儲值點數。
 * - 方案由擁有者設定（售價、點數、贈點分開；不假設 1 元 = 1 點）。
 * - 付款由金流 server-to-server 回呼確認後才入點；前端返回頁不憑參數加點。
 * - 入點走點數帳本（idempotencyKey = topup:<訂單>:paid / :bonus），回呼重送、重整、連點都不會重複入點。
 * - 已收款但入點失敗：狀態 CREDIT_FAILED，可由擁有者安全補入（同一把鍵，不會重複）。
 * - 正式環境沒有真實金流時，線上儲值不開放，不提供假的付款成功。
 */

export const TOPUP_HOLD_MINUTES = 30

export type TopUpStatus = 'PENDING' | 'PAID' | 'CREDITED' | 'CREDIT_FAILED' | 'FAILED' | 'EXPIRED' | 'CANCELLED'

export const TOPUP_STATUS_LABEL: Record<TopUpStatus, string> = {
  PENDING: '待付款',
  PAID: '付款已確認，入帳中',
  CREDITED: '已入帳',
  CREDIT_FAILED: '已收款，入帳失敗（待補入）',
  FAILED: '付款失敗',
  EXPIRED: '已逾時',
  CANCELLED: '已取消',
}

export class TopUpError extends Error {
  constructor(message: string, public code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'NOT_OPEN' | 'INVALID' = 'INVALID') {
    super(message)
  }
}

const isProductionRuntime = () => process.env.VERCEL_ENV === 'production' || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)

/**
 * 線上儲值是否開放：需要至少一個「非模擬」且已設定的金流；
 * 模擬金流只在非正式環境（本機開發、預覽）允許，用來驗證完整流程。
 * TapPay 以前端 SDK 收單，儲值流程尚未支援，先排除。
 */
export function topUpProviders() {
  return availableProviders().filter((p) => p.id !== 'tappay' && (p.id !== 'mock' || !isProductionRuntime()))
}

export function topUpAvailability(): { open: boolean; reason: string | null; simulated: boolean } {
  const providers = topUpProviders()
  if (providers.length === 0) return { open: false, reason: '線上儲值尚未開放：場館尚未接通正式金流。如需儲值請洽場館櫃台。', simulated: false }
  return { open: true, reason: null, simulated: providers.every((p) => p.id === 'mock') }
}

export async function listActivePlans() {
  return prisma.topUpPlan.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] })
}

function topUpCode(): string {
  const date = taipeiDateString().replace(/-/g, '')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tail = ''
  for (let i = 0; i < 4; i++) tail += chars[Math.floor(Math.random() * chars.length)]
  return `TP-${date}-${tail}`
}

/** 建立儲值單（只能為登入者本人；黑名單不能儲值；方案必須上架） */
export async function createTopUpOrder(userId: string, planId: string) {
  const avail = topUpAvailability()
  if (!avail.open) throw new TopUpError(avail.reason ?? '線上儲值尚未開放', 'NOT_OPEN')
  try {
    await assertNotRestricted(userId, 'BOOKING')
  } catch (err) {
    if (err instanceof RestrictedError) throw new TopUpError('此帳戶目前限制使用，無法儲值，若有疑問請聯絡場館。', 'UNAUTHORIZED')
    throw err
  }
  const plan = await prisma.topUpPlan.findUnique({ where: { id: planId } })
  if (!plan || !plan.active) throw new TopUpError('此儲值方案已下架，請重新選擇', 'NOT_FOUND')
  if (plan.price <= 0 || plan.points <= 0) throw new TopUpError('方案設定不完整，請聯絡場館', 'INVALID')
  await expireStaleTopUps()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.topUpOrder.create({
        data: {
          code: topUpCode(),
          userId,
          planId: plan.id,
          planName: plan.name,
          amount: plan.price,
          points: plan.points,
          bonusPoints: plan.bonusPoints,
          status: 'PENDING',
          expiresAt: new Date(now().getTime() + TOPUP_HOLD_MINUTES * 60_000),
        },
      })
    } catch (err) {
      if (attempt === 2) throw err
    }
  }
  throw new TopUpError('無法建立儲值單，請稍後再試')
}

export async function findTopUpByCode(code: string) {
  if (!code) return null
  const direct = await prisma.topUpOrder.findUnique({ where: { code } })
  if (direct) return direct
  const m = /^TP(\d{8})([A-Z0-9]{4})$/.exec(code)
  if (!m) return null
  return prisma.topUpOrder.findUnique({ where: { code: `TP-${m[1]}-${m[2]}` } })
}

export interface TopUpPaidInfo {
  provider: string
  method: string
  amount: number
  providerRef: string
  cardLast4?: string | null
  cardBrand?: string | null
  raw?: Record<string, unknown>
}

/**
 * 金流確認付款成功：搶處理權（PENDING → PAID 只會成功一次），再入點。
 * 重送的回呼會直接走「確保已入帳」，不會重複加點。
 */
export async function markTopUpPaid(orderId: string, info: TopUpPaidInfo): Promise<{ status: TopUpStatus; alreadyPaid: boolean }> {
  const order = await prisma.topUpOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new TopUpError('找不到儲值單', 'NOT_FOUND')
  if (info.amount !== order.amount) throw new TopUpError('付款金額與儲值單不符', 'INVALID')

  const at = now()
  // 只有 PENDING（含逾時但金流仍成功者）與 FAILED（先前失敗後重試成功）可以被確認；已付款／已入帳一律視為重送
  const claim = await prisma.topUpOrder.updateMany({
    where: { id: orderId, status: { in: ['PENDING', 'FAILED', 'EXPIRED'] } },
    data: {
      status: 'PAID',
      paidAt: at,
      provider: info.provider,
      method: info.method,
      providerRef: info.providerRef,
      cardLast4: info.cardLast4 ?? null,
      cardBrand: info.cardBrand ?? null,
      rawResponse: (info.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      failReason: null,
      expiresAt: null,
    },
  })
  const alreadyPaid = claim.count === 0
  const credited = await creditTopUpOrder(orderId, 'system')
  return { status: credited.status, alreadyPaid }
}

/**
 * 入點：付費點數與贈點各一筆帳本紀錄，鍵固定，重複呼叫不會重複入點。
 * 任何一步失敗 → CREDIT_FAILED（可追蹤、可安全補入，不要求客人再付一次）。
 */
export async function creditTopUpOrder(orderId: string, actor: string): Promise<{ status: TopUpStatus; credited: boolean }> {
  const order = await prisma.topUpOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new TopUpError('找不到儲值單', 'NOT_FOUND')
  if (order.status === 'CREDITED') return { status: 'CREDITED', credited: false }
  if (order.status !== 'PAID' && order.status !== 'CREDIT_FAILED') return { status: order.status as TopUpStatus, credited: false }
  try {
    await prisma.$transaction(
      async (tx) => {
        await applyPoints(tx, { userId: order.userId, delta: order.points, kind: 'TOPUP_PAID', reason: `儲值 ${order.code}（${order.planName}）`, actor, idempotencyKey: `topup:${order.id}:paid` })
        if (order.bonusPoints > 0) {
          await applyPoints(tx, { userId: order.userId, delta: order.bonusPoints, kind: 'TOPUP_BONUS', reason: `儲值 ${order.code} 贈點（${order.planName}）`, actor, idempotencyKey: `topup:${order.id}:bonus` })
        }
        const done = await tx.topUpOrder.updateMany({ where: { id: order.id, status: { in: ['PAID', 'CREDIT_FAILED'] } }, data: { status: 'CREDITED', creditedAt: now(), failReason: null } })
        if (done.count === 0) throw new PointsError('狀態已變更')
      },
      { maxWait: 15_000, timeout: 30_000 },
    )
    await prisma.auditLog.create({ data: { actor, action: 'TOPUP_CREDITED', target: order.userId, detail: { code: order.code, points: order.points, bonus: order.bonusPoints, amount: order.amount } } })
    return { status: 'CREDITED', credited: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : '入帳失敗'
    console.error('[topup] 入點失敗', { orderId, reason })
    await prisma.topUpOrder.updateMany({ where: { id: order.id, status: { in: ['PAID', 'CREDIT_FAILED'] } }, data: { status: 'CREDIT_FAILED', failReason: `入帳失敗：${reason}` } })
    return { status: 'CREDIT_FAILED', credited: false }
  }
}

/** 付款失敗（或金額不符）：記錄原因。keepPending = 只記錄，不改狀態（讓客人可再試） */
export async function recordTopUpFailure(orderId: string, provider: string, reason: string, raw?: Record<string, unknown>, opts: { keepPending?: boolean } = {}) {
  await prisma.topUpOrder.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { failReason: reason, provider, rawResponse: (raw ?? undefined) as Prisma.InputJsonValue | undefined, ...(opts.keepPending ? {} : { status: 'FAILED' }) },
  })
}

/** 逾時未付款的儲值單 → EXPIRED（付款若晚到仍可由回呼確認） */
export async function expireStaleTopUps(): Promise<number> {
  const r = await prisma.topUpOrder.updateMany({ where: { status: 'PENDING', expiresAt: { lt: now() } }, data: { status: 'EXPIRED' } })
  return r.count
}

/** 會員本人的儲值紀錄 */
export async function listUserTopUps(userId: string, take = 20) {
  await expireStaleTopUps()
  return prisma.topUpOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
}

/** 會員本人的點數帳本（含儲值、折抵、退款） */
export async function listUserLedger(userId: string, take = 30) {
  return prisma.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
}

/** 付費點數與贈點的累計（供前台呈現「付費／贈送分開記錄」） */
export async function userPointsBreakdown(userId: string) {
  const rows = await prisma.pointsLedger.groupBy({ by: ['kind'], where: { userId }, _sum: { delta: true } })
  const sum = (k: string) => rows.find((r) => r.kind === k)?._sum.delta ?? 0
  return { paid: sum('TOPUP_PAID'), bonus: sum('TOPUP_BONUS'), redeemed: -sum('REDEEM'), refunded: sum('REFUND') + sum('RELEASE'), admin: sum('ADMIN_ADD') + sum('ADMIN_DEDUCT') }
}
