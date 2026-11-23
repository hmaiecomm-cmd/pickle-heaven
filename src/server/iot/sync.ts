import 'server-only'
import { isDemoTenant, prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { gateway, GatewayError, iotGatewayConfig } from './gateway-client'
import { buildSitePlan } from './site-plan'

/**
 * 把場館計畫推到 IoT Gateway。內容沒變 Gateway 不會遞增版本，所以可以放心多推。
 * 觸發時機：
 *   - 訂單付款／取消／退款後（syncSlotPasswordsForBookingSafe）
 *   - 手動開關迴路、恢復排程後
 *   - 每 15 分鐘排程（/api/cron/slot-passwords），讓 48 小時視窗往前滾動並涵蓋活動、封場、排程修改
 * 展示環境與未設定 Gateway／場館代碼時不做任何事。
 */

export function iotEnabled() {
  return iotGatewayConfig() !== null
}

export async function pushSitePlan(venueId: string): Promise<{ siteId: string; rev: number; changed: boolean } | null> {
  if (!iotEnabled() || (await isDemoTenant())) return null
  const plan = await buildSitePlan(venueId, now())
  if (!plan) return null
  try {
    const r = await gateway.putPlan(plan)
    return { siteId: plan.siteId, ...r }
  } catch (err) {
    // 第一次推送時 Gateway 尚未建立場館 → 建立後重試
    if (err instanceof GatewayError && err.status === 404) {
      const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } })
      const name = venue?.name ?? plan.siteId
      await gateway.upsertSite(plan.siteId, plan.siteId.endsWith('-sim') ? `${name}（模擬器）` : name, venueId)
      const r = await gateway.putPlan(plan)
      return { siteId: plan.siteId, ...r }
    }
    throw err
  }
}

/** 不讓 IoT 失敗影響訂單、後台操作本身 */
export async function pushSitePlanSafe(venueId: string) {
  try {
    return await pushSitePlan(venueId)
  } catch (err) {
    console.error('[iot] 推送場館計畫失敗', venueId, err)
    return null
  }
}

export async function pushAllSitePlans() {
  if (!iotEnabled() || (await isDemoTenant())) return []
  const venues = await prisma.venue.findMany({ where: { active: true, siteCode: { not: null } }, select: { id: true } })
  const out = []
  for (const v of venues) out.push({ venueId: v.id, result: await pushSitePlanSafe(v.id) })
  return out
}

export async function pushSitePlanForBookingSafe(bookingId: string) {
  if (!iotEnabled()) return
  try {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { venueId: true } })
    if (b) await pushSitePlanSafe(b.venueId)
  } catch (err) {
    console.error('[iot] 依訂單推送場館計畫失敗', bookingId, err)
  }
}
