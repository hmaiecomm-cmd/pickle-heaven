'use client'

import * as React from 'react'
import Link from 'next/link'
import { groupIntoCards, shortDateLabel, type ActivitySessionDTO } from '@/lib/activity-shared'
import { fetchUpcomingSessions } from '@/server/activity-actions'
import { ActivityCard } from './activity-card'

/**
 * 預約表下方的「當日活動」。跟隨上方選擇的日期；
 * 當天沒有活動時明確寫出「這一天暫無活動」，另列標示日期的近期活動，不與當日場次混在一起。
 */
export function DayActivities({
  date,
  events,
  onOpen,
  now,
}: {
  date: string
  events: ActivitySessionDTO[]
  onOpen: (sessionId: string) => void
  /** 伺服器時間 ISO：已結束的場次依時段規則隱藏；進行中的是否可報名由場次自己的狀態決定 */
  now?: string
}) {
  const visible = events.filter((e) => e.state !== 'CANCELLED' && (!now || e.endAt > now))
  const [upcoming, setUpcoming] = React.useState<ActivitySessionDTO[] | null>(null)

  React.useEffect(() => {
    if (visible.length > 0) return
    let alive = true
    setUpcoming(null)
    void fetchUpcomingSessions(date).then((res) => {
      if (alive) setUpcoming(res.ok ? res.sessions : [])
    })
    return () => {
      alive = false
    }
  }, [date, visible.length])

  return (
    <section aria-labelledby="day-activities-title" className="rounded-3xl bg-[#F5F1E8] p-5 sm:p-7">
      <p className="text-xs font-bold tracking-[0.2em] text-[#6941A5]">ACTIVITIES・{shortDateLabel(date)}</p>
      <h2 id="day-activities-title" className="mt-2 text-2xl font-extrabold text-[#191D1A] sm:text-3xl">
        這一天，也可以這樣玩。
      </h2>
      <p className="mt-2 text-sm text-[#191D1A]/70">除了預約場地，也能加入活動，認識一起打球的夥伴。</p>

      {visible.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <ActivityCard
              key={s.id}
              card={{ ...groupIntoCards([s])[0] }}
              onOpen={onOpen}
              showDates={false}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <p className="rounded-2xl border-2 border-dashed border-[#30223D]/20 px-4 py-6 text-center font-semibold text-[#30223D]">
            {shortDateLabel(date)} 這一天暫無活動
          </p>
          {upcoming === null ? (
            <p className="text-sm text-[#191D1A]/60">讀取近期活動中…</p>
          ) : upcoming.length > 0 ? (
            <div>
              <h3 className="text-base font-extrabold text-[#191D1A]">近期活動（其他日期）</h3>
              <p className="mt-1 text-xs text-[#191D1A]/60">以下為其他日期的場次，請留意卡片上的日期。</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {groupIntoCards(upcoming).map((card) => (
                  <ActivityCard key={card.key} card={card} onOpen={onOpen} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#191D1A]/60">近期沒有已公布的活動。</p>
          )}
        </div>
      )}

      <div className="mt-6 text-right">
        <Link href="/sessions" className="text-sm font-bold text-[#6941A5] underline underline-offset-4 hover:text-[#30223D]">
          查看所有活動
        </Link>
      </div>
    </section>
  )
}
