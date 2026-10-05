'use client'

import * as React from 'react'
import { Check, Loader2, Lock, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { courtEnvLabel } from '@/lib/types'
import type { AvailabilityDTO, SlotState } from '@/lib/types'

const CELL_STYLE: Record<SlotState, string> = {
  AVAILABLE:
    'surface border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer',
  SELECTED: 'border-brand-600 bg-brand-600 text-white shadow-sm cursor-pointer',
  HELD: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300 cursor-not-allowed',
  BOOKED: 'border-transparent surface-2 text-[rgb(var(--fg-muted))] cursor-not-allowed',
  BLOCKED: 'border-transparent surface-2 text-[rgb(var(--fg-muted))] cursor-not-allowed',
  PAST: 'border-transparent bg-transparent text-[rgb(var(--fg-muted))] opacity-45 cursor-not-allowed',
  CLOSED: 'border-transparent bg-transparent text-[rgb(var(--fg-muted))] opacity-45 cursor-not-allowed',
}

const CELL_TEXT: Partial<Record<SlotState, string>> = {
  HELD: '暫扣中',
  BOOKED: '已預約',
  BLOCKED: '維護',
  PAST: '—',
  CLOSED: '—',
}

export function SlotMatrix({
  data,
  pendingKey,
  onToggle,
  busy,
}: {
  data: AvailabilityDTO
  /** 正在送出的格子 key（courtId@start），顯示轉圈 */
  pendingKey: string | null
  onToggle: (courtId: string, start: number, state: SlotState) => void
  busy?: boolean
}) {
  const { courts, times, cells } = data

  return (
    <div
      className={cn(
        'matrix-scroll rounded-2xl border border-[rgb(var(--border))] surface transition-opacity',
        busy && 'opacity-60',
      )}
    >
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `88px repeat(${courts.length}, minmax(86px, 1fr))` }}
        role="grid"
        aria-label="場地與時段表"
      >
        {/* 表頭 */}
        <div className="sticky left-0 top-0 z-30 border-b border-r border-[rgb(var(--border))] surface px-2 py-2.5 text-[11px] font-medium text-muted">
          時段
        </div>
        {courts.map((court) => (
          <div
            key={court.id}
            role="columnheader"
            className="sticky top-0 z-20 border-b border-[rgb(var(--border))] surface px-2 py-2.5 text-center"
          >
            <div className="text-[13px] font-semibold leading-tight">{court.name}</div>
            <div className="mt-0.5 text-[10px] text-muted">{courtEnvLabel(court)}</div>
          </div>
        ))}

        {/* 時段列 */}
        {times.map((time, rowIdx) => (
          <React.Fragment key={time.start}>
            <div
              role="rowheader"
              className="sticky left-0 z-10 border-b border-r border-[rgb(var(--border))] surface px-2 py-2"
            >
              <div className="text-[13px] font-semibold leading-tight tabular">{time.label.split('–')[0]}</div>
              <div className="mt-0.5 flex items-center gap-1">
                <span
                  className={cn(
                    'rounded px-1 py-px text-[9px] font-medium',
                    time.kind === 'PEAK'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
                  )}
                >
                  {time.rateName}
                </span>
              </div>
            </div>

            {courts.map((court, colIdx) => {
              const state = cells[rowIdx][colIdx]
              const key = `${court.id}@${time.start}`
              const isPending = pendingKey === key
              const interactive = state === 'AVAILABLE' || state === 'SELECTED'

              return (
                <div key={court.id} className="border-b border-[rgb(var(--border))] p-1">
                  <button
                    type="button"
                    role="gridcell"
                    disabled={!interactive || isPending}
                    aria-pressed={state === 'SELECTED'}
                    aria-label={`${court.name} ${time.label} ${
                      state === 'AVAILABLE' ? `可預約 ${time.price} 元` : (CELL_TEXT[state] ?? '已選取')
                    }`}
                    onClick={() => interactive && onToggle(court.id, time.start, state)}
                    className={cn(
                      'flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-all active:scale-[.97]',
                      CELL_STYLE[state],
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : state === 'SELECTED' ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden />
                        <span className="text-[10px] tabular">${time.price}</span>
                      </>
                    ) : state === 'AVAILABLE' ? (
                      <span className="tabular text-[13px]">${time.price}</span>
                    ) : state === 'BLOCKED' ? (
                      <>
                        <Wrench className="h-3.5 w-3.5" aria-hidden />
                        <span className="text-[10px]">維護</span>
                      </>
                    ) : state === 'BOOKED' ? (
                      <>
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        <span className="text-[10px]">已預約</span>
                      </>
                    ) : (
                      <span className="text-[10px]">{CELL_TEXT[state]}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const LEGEND: { state: SlotState; label: string }[] = [
  { state: 'AVAILABLE', label: '可預約' },
  { state: 'SELECTED', label: '已選取' },
  { state: 'HELD', label: '他人暫扣' },
  { state: 'BOOKED', label: '已預約' },
  { state: 'BLOCKED', label: '維護中' },
]

export function MatrixLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
      {LEGEND.map((item) => (
        <li key={item.state} className="flex items-center gap-1.5">
          <span className={cn('h-3.5 w-3.5 rounded border', CELL_STYLE[item.state].replace(/cursor-\w+/g, ''))} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
