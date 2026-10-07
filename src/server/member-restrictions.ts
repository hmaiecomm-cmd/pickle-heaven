import 'server-only'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'

/**
 * 會員限制與黑名單。
 * BLACKLIST：禁止所有線上預約與報名；NO_ACTIVITY：禁止報名活動。
 * 限制在後端的建立訂單、加入活動時檢查，不是只在畫面隱藏按鈕。
 */

export const RESTRICTION_LABEL: Record<string, string> = { BLACKLIST: '黑名單（禁止線上預約與報名）', NO_ACTIVITY: '禁止報名活動' }

export async function activeRestrictions(userId: string) {
  const at = now()
  return prisma.memberRestriction.findMany({
    where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
  })
}

export class RestrictedError extends Error {
  code = 'UNAUTHORIZED' as const
}

/** 建立訂單或報名活動前呼叫；有限制就丟出錯誤（訊息不透露內部原因） */
export async function assertNotRestricted(userId: string, kind: 'BOOKING' | 'ACTIVITY') {
  const list = await activeRestrictions(userId)
  const hit = list.find((r) => r.type === 'BLACKLIST' || (kind === 'ACTIVITY' && r.type === 'NO_ACTIVITY'))
  if (hit) throw new RestrictedError('您的帳號目前無法線上預約或報名，請聯絡場館')
}
