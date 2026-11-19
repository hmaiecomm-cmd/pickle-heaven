import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { groupIntoCards } from '@/lib/activity-shared'
import { getUpcomingSessions } from '@/server/activity-service'
import { getMemberRestrictionsSummary } from '@/server/member-restrictions'
import { ActivityList } from '@/components/activities/activity-list'
import { ActivityFilter } from './activity-filter'
import { ActivitiesPageClient } from './activities-page-client'

export const metadata: Metadata = {
  title: '活動',
  description: '大新店森林匹克球的球友集合、新手體驗與交流活動，線上選擇場次並報名。',
}
export const dynamic = 'force-dynamic'

/**
 * 活動列表。週期活動合併成一張卡片，卡片下列出近期可報名日期；
 * 每個日期是獨立場次，選取後顯示該場實際價格與剩餘名額。
 */
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; qty?: string }>
}) {
  const sp = await searchParams
  const [user, venue] = await Promise.all([
    getSessionUser(),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } }),
  ])

  // 檢查會員限制
  let restrictions = null
  if (user) {
    restrictions = await getMemberRestrictionsSummary(user.id)
  }

  const sessions = venue ? await getUpcomingSessions(venue.id, user?.id ?? null, { days: 90, limit: 120 }) : []
  const cards = groupIntoCards(sessions)
  const qty = Number(sp.qty)

  return (
    <ActivitiesPageClient
      cards={cards}
      restrictions={restrictions}
      initialSessionId={sp.session ?? null}
      initialQuantity={Number.isInteger(qty) && qty > 0 ? qty : undefined}
    />
  )
}
