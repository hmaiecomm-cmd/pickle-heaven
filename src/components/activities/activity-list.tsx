'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityCardDTO } from '@/lib/activity-shared'
import { ActivityCard } from './activity-card'
import { SessionPanel } from './session-panel'

/** 活動列表：圖片卡片＋詳細面板。網址 ?session= 可直接開啟某一場（登入返回、分享連結）。 */
export function ActivityList({
  cards,
  initialSessionId,
  initialQuantity,
}: {
  cards: ActivityCardDTO[]
  initialSessionId: string | null
  initialQuantity?: number
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState<string | null>(initialSessionId)

  const setUrl = (sessionId: string | null) => {
    const url = new URL(window.location.href)
    if (sessionId) url.searchParams.set('session', sessionId)
    else {
      url.searchParams.delete('session')
      url.searchParams.delete('qty')
    }
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <>
      {cards.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-[#281343]/20 px-4 py-12 text-center font-semibold text-[#281343]">
          近期沒有已公布的活動
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ActivityCard
              key={card.key}
              card={card}
              onOpen={(id) => {
                setOpen(id)
                setUrl(id)
              }}
            />
          ))}
        </div>
      )}
      <SessionPanel
        sessionId={open}
        initialQuantity={initialQuantity}
        onClose={() => {
          setOpen(null)
          setUrl(null)
          router.refresh()
        }}
      />
    </>
  )
}
