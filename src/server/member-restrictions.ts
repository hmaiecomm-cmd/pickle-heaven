import 'server-only'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { RESTRICTION_TYPES, type RestrictionType, isActionBlocked } from '@/lib/restriction-types'

/**
 * 會員限制與黑名單。
 * 支援多種限制類型（BLACKLIST, NO_ACTIVITY, NO_BOOKING, NO_ORDER, CUSTOM）
 * 限制在後端驗證，不依賴前端隱藏按鈕
 */

export async function activeRestrictions(userId: string) {
  const at = now()
  return prisma.memberRestriction.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    },
    orderBy: { createdAt: 'desc' },
  })
}

export class RestrictedError extends Error {
  code = 'UNAUTHORIZED' as const

  constructor(
    public restrictionType: RestrictionType,
    message?: string,
  ) {
    super(message)
    this.name = 'RestrictedError'
  }
}

/**
 * 檢查會員是否被限制執行某項操作
 * @param userId 會員 ID
 * @param action 操作類型：'booking' | 'activity' | 'order' | 'points'
 * @throws RestrictedError 如有限制
 */
export async function assertNotRestricted(
  userId: string,
  action: 'booking' | 'activity' | 'order' | 'points',
): Promise<void> {
  const list = await activeRestrictions(userId)

  for (const restriction of list) {
    // 黑名單禁止所有操作
    if (restriction.type === 'BLACKLIST') {
      const actionLabel = {
        booking: '預約場地',
        activity: '報名活動',
        order: '下單購買',
        points: '使用點數',
      }[action]

      throw new RestrictedError(
        'BLACKLIST',
        `此會員目前受到黑名單限制，無法${actionLabel}。若有疑問，請聯絡場館。`,
      )
    }

    // 其他限制檢查是否影響此操作
    const typeConfig = RESTRICTION_TYPES[restriction.type as RestrictionType]
    if (typeConfig && isActionBlocked(restriction.type as RestrictionType, action)) {
      throw new RestrictedError(
        restriction.type as RestrictionType,
        `此會員目前${typeConfig.description}，無法執行此操作。`,
      )
    }
  }
}

/**
 * 獲取會員目前的活躍限制列表（用於前後台顯示）
 */
export async function getMemberRestrictionsSummary(userId: string) {
  const restrictions = await activeRestrictions(userId)
  const at = now()

  return {
    hasBlacklist: restrictions.some((r) => r.type === 'BLACKLIST'),
    hasNoActivity: restrictions.some((r) => r.type === 'NO_ACTIVITY'),
    hasNoBooking: restrictions.some((r) => r.type === 'NO_BOOKING'),
    hasNoOrder: restrictions.some((r) => r.type === 'NO_ORDER'),
    all: restrictions.map((r) => ({
      type: r.type as RestrictionType,
      label: RESTRICTION_TYPES[r.type as RestrictionType]?.label ?? r.type,
      description: RESTRICTION_TYPES[r.type as RestrictionType]?.description,
      reason: r.reason,
      expiresAt: r.expiresAt,
      isExpiringSoon: r.expiresAt && r.expiresAt.getTime() - at.getTime() < 7 * 24 * 60 * 60 * 1000, // 7天內過期
    })),
  }
}
