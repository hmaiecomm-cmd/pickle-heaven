'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ActivityCardDTO } from '@/lib/activity-shared'
import { ActivityList } from '@/components/activities/activity-list'
import { ActivityFilter } from './activity-filter'

interface ActivitiesPageClientProps {
  cards: ActivityCardDTO[]
  restrictions: {
    hasBlacklist: boolean
    hasNoActivity: boolean
    hasNoBooking?: boolean
    hasNoOrder?: boolean
    all: Array<{
      type: string
      label: string
      description: string
      reason: string
      expiresAt: Date | null
      isExpiringSoon: boolean | null
    }>
  } | null
  initialSessionId: string | null
  initialQuantity?: number
}

export function ActivitiesPageClient({
  cards,
  restrictions,
  initialSessionId,
  initialQuantity,
}: ActivitiesPageClientProps) {
  const [filteredCards, setFilteredCards] = React.useState<ActivityCardDTO[]>(cards)

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

      {/* 顯示會員限制警告 */}
      {restrictions && (restrictions.hasBlacklist || restrictions.hasNoActivity) && (
        <div className="mx-4 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4 sm:mx-8">
          <p className="text-sm font-medium text-orange-900">
            {restrictions.hasBlacklist
              ? '⛔ 您的帳戶目前受到限制，無法報名活動。'
              : '⛔ 您目前禁止報名新的活動。'}
          </p>
          {restrictions.all[0]?.expiresAt && (
            <p className="mt-1 text-xs text-orange-700">
              限制將在 {new Date(restrictions.all[0].expiresAt).toLocaleDateString('zh-TW')} 解除。
            </p>
          )}
          <p className="mt-1 text-xs text-orange-700">若有疑問，請聯絡場館客服。</p>
        </div>
      )}

      {/* 如果被黑名單限制，不顯示活動列表 */}
      {restrictions?.hasBlacklist ? (
        <div className="mx-4 rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-600 sm:mx-8">
          請解除限制後再報名活動。
        </div>
      ) : (
        <>
          {/* 活動篩選 */}
          <div className="px-4 sm:px-8">
            <ActivityFilter cards={cards} onFilteredCards={setFilteredCards} />
          </div>

          {/* 活動列表標題 */}
          <div className="px-4 sm:px-8">
            <h2 className="text-xl font-bold text-white mb-4">活動列表</h2>
          </div>

          {/* 活動列表 */}
          <ActivityList
            cards={filteredCards}
            initialSessionId={initialSessionId}
            initialQuantity={initialQuantity}
          />
        </>
      )}
    </div>
  )
}
