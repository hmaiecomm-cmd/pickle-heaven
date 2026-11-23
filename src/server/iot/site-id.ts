import 'server-only'
import { prisma } from '@/lib/db'

/**
 * IoT 連線對象：同一個場館有兩個 Gateway 身分
 *   LIVE       ＝ 實體場館電腦，Gateway 場館 ID = siteCode（例 xindian001）
 *   SIMULATOR  ＝ 網頁模擬器，  Gateway 場館 ID = siteCode-sim
 * 平台推計畫、下指令只送給「目前的連線對象」；webhook 只採用目前連線對象的回報，另一個的回報忽略。
 */

export type IotTarget = 'LIVE' | 'SIMULATOR'
export const SIM_SUFFIX = '-sim'

export const normalizeTarget = (v: unknown): IotTarget => (v === 'SIMULATOR' ? 'SIMULATOR' : 'LIVE')

export function siteIdFor(siteCode: string, target: IotTarget): string {
  return target === 'SIMULATOR' ? `${siteCode}${SIM_SUFFIX}` : siteCode
}

/** 場館目前要連的 Gateway 場館 ID；沒設定場館代碼回 null */
export function activeSiteId(v: { siteCode: string | null; iotTarget?: string | null }): string | null {
  return v.siteCode ? siteIdFor(v.siteCode, normalizeTarget(v.iotTarget)) : null
}

export async function activeSiteIdOf(venueId: string): Promise<string | null> {
  const v = await prisma.venue.findUnique({ where: { id: venueId }, select: { siteCode: true, iotTarget: true } })
  return v ? activeSiteId(v) : null
}

/** Gateway 場館 ID → 場館；active=false 表示這個身分不是目前的連線對象 */
export async function venueForSiteId(siteId: string) {
  const sim = siteId.endsWith(SIM_SUFFIX)
  const code = sim ? siteId.slice(0, -SIM_SUFFIX.length) : siteId
  const venue = await prisma.venue.findUnique({ where: { siteCode: code }, select: { id: true, iotTarget: true } })
  if (!venue) return null
  const target: IotTarget = sim ? 'SIMULATOR' : 'LIVE'
  return { venueId: venue.id, target, active: normalizeTarget(venue.iotTarget) === target }
}
