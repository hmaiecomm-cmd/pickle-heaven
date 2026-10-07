import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isUniqueViolation } from './occupancy'

/**
 * 點數帳本：餘額只能透過帳本推進，不直接覆寫。
 * - 扣點以「餘額足夠」為條件更新，不會變成負數。
 * - idempotencyKey 唯一：同一事件重複送出只會記一筆（重試、回呼、連點都安全）。
 */

export type PointsKind = 'ADMIN_ADD' | 'ADMIN_DEDUCT' | 'REDEEM' | 'REFUND' | 'RELEASE'

export const POINTS_KIND_LABEL: Record<PointsKind, string> = {
  ADMIN_ADD: '後台加點',
  ADMIN_DEDUCT: '後台扣點',
  REDEEM: '結帳折抵',
  REFUND: '退款回補',
  RELEASE: '訂單取消歸還',
}

export class PointsError extends Error {}

export async function applyPoints(
  tx: Prisma.TransactionClient,
  params: { userId: string; delta: number; kind: PointsKind; reason: string; actor: string; idempotencyKey: string; bookingId?: string | null },
): Promise<{ balanceAfter: number; duplicate: boolean }> {
  const { userId, delta } = params
  if (!Number.isInteger(delta) || delta === 0) throw new PointsError('點數異動數量不正確')

  const existing = await tx.pointsLedger.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
  if (existing) return { balanceAfter: existing.balanceAfter, duplicate: true }

  // 扣點只在餘額足夠時成立（原子條件更新）
  const updated = await tx.user.updateMany({
    where: { id: userId, ...(delta < 0 ? { points: { gte: -delta } } : {}) },
    data: { points: { increment: delta } },
  })
  if (updated.count === 0) throw new PointsError(delta < 0 ? '點數餘額不足，無法扣點' : '找不到會員')
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } })
  try {
    await tx.pointsLedger.create({
      data: { userId, delta, balanceAfter: user.points, kind: params.kind, reason: params.reason, actor: params.actor, idempotencyKey: params.idempotencyKey, bookingId: params.bookingId ?? null },
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw new PointsError('重複提交，已略過')
    throw err
  }
  return { balanceAfter: user.points, duplicate: false }
}

/** 後台加點／扣點：以交易執行，回傳前後餘額 */
export async function adminAdjustPoints(params: { userId: string; delta: number; reason: string; actor: string; idempotencyKey: string }) {
  const before = await prisma.user.findUnique({ where: { id: params.userId }, select: { points: true, displayName: true } })
  if (!before) throw new PointsError('找不到會員')
  const res = await prisma.$transaction(
    (tx) => applyPoints(tx, { ...params, kind: params.delta > 0 ? 'ADMIN_ADD' : 'ADMIN_DEDUCT' }),
    { maxWait: 15_000, timeout: 30_000 },
  )
  return { displayName: before.displayName, balanceBefore: res.duplicate ? res.balanceAfter - params.delta : before.points, balanceAfter: res.balanceAfter, duplicate: res.duplicate }
}
