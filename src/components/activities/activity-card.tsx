'use client'

import * as React from 'react'
import { CalendarDays, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityCardDTO } from '@/lib/activity-shared'
import { ActivityCover, priceText, SignupBadge } from './activity-cover'

/**
 * 活動圖片卡片：上方 16:9 封面、下方資訊。
 * 週期活動合併為一張卡，下方列出近期日期；選取日期後顯示該場的實際價格與名額。
 * 所有資訊都直接顯示，不依賴滑鼠移入。
 */
export function ActivityCard({
  card,
  onOpen,
  showDates = true,
}: {
  card: ActivityCardDTO
  onOpen: (sessionId: string) => void
  /** 當日活動區塊只有單場時，不必列日期選擇 */
  showDates?: boolean
}) {
  const [selectedId, setSelectedId] = React.useState(card.sessions[0]?.id)
  const s = card.sessions.find((x) => x.id === selectedId) ?? card.sessions[0]
  if (!s) return null
  const multiple = card.sessions.length > 1

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-[#211A2B]/10">
      <div className="relative aspect-video bg-[#EEE6FA]">
        <ActivityCover cover={card.cover} title={card.title} typeLabel={card.typeLabel} thumb />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#281343] px-2.5 py-0.5 text-xs font-bold text-white">{card.typeLabel}</span>
          {card.levelLabel && (
            <span className="rounded-full bg-[#EEE6FA] px-2.5 py-0.5 text-xs font-bold text-[#281343]">{card.levelLabel}</span>
          )}
        </div>
        <div>
          <h3 className="text-lg font-extrabold leading-snug text-[#211A2B]">{card.title}</h3>
          {card.summary && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#211A2B]/70">{card.summary}</p>}
        </div>

        {showDates && multiple && (
          <div>
            <p className="text-xs font-semibold text-[#211A2B]/60">近期場次（選擇日期查看該場價格與名額）</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${card.title} 的場次`}>
              {card.sessions.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={x.id === s.id}
                  onClick={() => setSelectedId(x.id)}
                  className={cn(
                    'min-h-9 rounded-full px-3 text-sm font-semibold ring-1 transition-colors',
                    x.id === s.id ? 'bg-[#713CDE] text-white ring-[#713CDE]' : 'bg-white text-[#281343] ring-[#281343]/25 hover:bg-[#EEE6FA]',
                    (x.state === 'FULL' || x.state === 'CLOSED') && x.id !== s.id && 'text-[#211A2B]/50',
                  )}
                >
                  {x.dateLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        <dl className="grid gap-1.5 text-sm text-[#211A2B]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#713CDE]" aria-hidden />
            <dt className="sr-only">日期</dt>
            <dd className="font-semibold">{s.dateLabel}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#713CDE]" aria-hidden />
            <dt className="sr-only">時間</dt>
            <dd className="font-semibold tabular">{s.timeLabel}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#713CDE]" aria-hidden />
            <dt className="sr-only">名額</dt>
            <dd>
              {s.state === 'OPEN' || s.state === 'FULL' || s.state === 'NOT_OPEN' ? `剩餘 ${s.remaining} 位（共 ${s.capacity} 位）` : `共 ${s.capacity} 位`}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
          <div>
            <p className="text-xl font-extrabold text-[#281343] tabular">{priceText(s.price, s.unitLabel)}</p>
            <SignupBadge state={s.state} label={s.state === 'NOT_OPEN' && s.opensAtLabel ? s.opensAtLabel : s.stateLabel} className="mt-1" />
          </div>
          <button
            type="button"
            onClick={() => onOpen(s.id)}
            className="inline-flex h-11 items-center rounded-full bg-[#713CDE] px-5 text-sm font-bold text-white transition-colors hover:bg-[#281343] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713CDE]"
          >
            {multiple ? '選擇場次' : '查看詳情'}
          </button>
        </div>
      </div>
    </article>
  )
}
