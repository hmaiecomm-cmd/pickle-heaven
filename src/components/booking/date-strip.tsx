'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateLabel, isWeekend, relativeDayLabel, taipeiDateString } from '@/lib/time'

export function DateStrip({
  dates,
  value,
  onChange,
  disabled,
}: {
  dates: string[]
  value: string
  onChange: (date: string) => void
  disabled?: boolean
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const today = taipeiDateString()

  // 選取日期時自動捲到可視範圍。
  // 這裡刻意手動計算 scrollLeft 而非使用 scrollIntoView——後者會連帶捲動祖先元素，
  // 導致每次更新時整個頁面上下跳動。
  React.useEffect(() => {
    const scroller = scrollerRef.current
    const el = scroller?.querySelector<HTMLElement>(`[data-date="${value}"]`)
    if (!scroller || !el) return

    const target = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [value])

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-0.5 py-1"
        role="radiogroup"
        aria-label="選擇預約日期"
      >
        {dates.map((date) => {
          const { md, weekday, day } = formatDateLabel(date)
          const selected = date === value
          const weekendDay = isWeekend(date)
          const isToday = date === today

          return (
            <button
              key={date}
              type="button"
              data-date={date}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(date)}
              className={cn(
                'group relative flex min-w-[68px] shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition-all',
                selected
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-[rgb(var(--border))] surface hover:border-brand-300',
                disabled && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-medium',
                  selected ? 'text-brand-50' : weekendDay ? 'text-red-500' : 'text-muted',
                )}
              >
                {relativeDayLabel(date, today) === weekday ? weekday : relativeDayLabel(date, today)}
              </span>
              <span className="text-xl font-semibold leading-none tabular">{day}</span>
              <span className={cn('text-[10px] tabular', selected ? 'text-brand-100' : 'text-muted')}>{md}</span>
              {isToday && !selected && (
                <span className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-brand-500" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {/* 桌機左右捲動按鈕 */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="前幾天"
        className="absolute -left-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[rgb(var(--border))] surface shadow-sm hover:surface-2 lg:grid"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="後幾天"
        className="absolute -right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[rgb(var(--border))] surface shadow-sm hover:surface-2 lg:grid"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
