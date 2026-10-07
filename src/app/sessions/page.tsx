import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { groupIntoCards } from '@/lib/activity-shared'
import { getUpcomingSessions } from '@/server/activity-service'
import { ActivityList } from '@/components/activities/activity-list'

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
  const sessions = venue ? await getUpcomingSessions(venue.id, user?.id ?? null, { days: 90, limit: 120 }) : []
  const cards = groupIntoCards(sessions)
  const qty = Number(sp.qty)

  return (
    <div className="space-y-6 pb-6">
      <header className="rounded-3xl bg-[#30223D] px-5 py-8 text-white sm:px-8">
        <p className="text-xs font-bold tracking-[0.2em] text-[#EEE6FA]">ACTIVITIES</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">一起上場，認識新的球友。</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
          選一場喜歡的活動，挑好日期與人數，加入購物車並完成付款就報名成功。想自己揪團，也可以
          <Link href="/booking" className="mx-1 font-bold underline underline-offset-4">
            預約場地
          </Link>
          。
        </p>
      </header>
      <ActivityList
        cards={cards}
        initialSessionId={sp.session ?? null}
        initialQuantity={Number.isInteger(qty) && qty > 0 ? qty : undefined}
      />
    </div>
  )
}
