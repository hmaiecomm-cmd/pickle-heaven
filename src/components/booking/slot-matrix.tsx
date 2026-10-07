'use client'

import * as React from 'react'
import { CalendarHeart, Check, Clock, Hourglass, Loader2, Lock, PlayCircle, ShieldBan, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { courtEnvLabel } from '@/lib/types'
import type { AvailabilityDTO, SlotState } from '@/lib/types'
import { shortDateLabel, type ActivitySessionDTO } from '@/lib/activity-shared'

/**
 * 場地 × 時段表。
 * 一般可訂格維持乾淨淺色；活動以淡紫底、深紫字的連續區塊呈現（佔兩小時就是一整塊），
 * 跨多面場地時每一欄都標示，但都連到同一個場次。
 * 每種狀態除了顏色，一定有圖示或文字；今日已結束的時段由伺服器整列移除，不會出現在這裡。
 */

const CELL_STYLE: Record<SlotState, string> = {
  AVAILABLE:
    'bg-white border-[rgb(var(--border))] text-[#191D1A] hover:border-brand-500 hover:bg-brand-50 cursor-pointer',
  SELECTED: 'border-brand-600 bg-brand-600 text-white shadow-sm cursor-pointer',
  HELD: 'border-amber-200 bg-amber-50 text-amber-800 cursor-not-allowed',
  BOOKED: 'border-transparent bg-zinc-100 text-zinc-600 cursor-not-allowed',
  BLOCKED: 'border-transparent bg-zinc-100 text-zinc-600 cursor-not-allowed',
  RESERVED: 'border-transparent bg-zinc-100 text-zinc-600 cursor-not-allowed',
  MAINTENANCE: 'border-transparent bg-zinc-100 text-zinc-600 cursor-not-allowed',
  EVENT: 'border-brand-600/40 bg-brand-100 text-brand-900',
  STARTED: 'border-transparent bg-zinc-50 text-zinc-500 cursor-not-allowed',
  CUTOFF: 'border-transparent bg-zinc-50 text-zinc-500 cursor-not-allowed',
  PAST: 'border-transparent bg-zinc-50 text-zinc-400 cursor-not-allowed',
  CLOSED: 'border-transparent bg-zinc-50 text-zinc-400 cursor-not-allowed',
}

const CELL_TEXT: Partial<Record<SlotState, string>> = {
  HELD: '保留中',
  BOOKED: '已預約',
  BLOCKED: '封場',
  MAINTENANCE: '清潔維護・暫不開放',
  RESERVED: '活動占用・不開放租借',
  STARTED: '已開始',
  CUTOFF: '已截止',
  PAST: '已結束',
  CLOSED: '未開放',
}

const CELL_ICON: Partial<Record<SlotState, typeof Lock>> = {
  HELD: Clock,
  BOOKED: Lock,
  BLOCKED: ShieldBan,
  MAINTENANCE: Wrench,
  RESERVED: CalendarHeart,
  STARTED: PlayCircle,
  CUTOFF: Hourglass,
}

export function SlotMatrix({
  data,
  pendingKey,
  onToggle,
  onOpenEvent,
  busy,
}: {
  data: AvailabilityDTO
  /** 正在送出的格子 key（courtId@start），顯示轉圈 */
  pendingKey: string | null
  onToggle: (courtId: string, start: number, state: SlotState) => void
  onOpenEvent: (sessionId: string) => void
  busy?: boolean
}) {
  const { courts, times, cells, cellSessions } = data
  const events = React.useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events])
  const unit = data.venue.slotMinutes === 60 ? '每小時' : `每 ${data.venue.slotMinutes} 分`

  // 每一欄把同一場次的連續格合併成一個區塊
  const blocks: { col: number; row: number; span: number; event: ActivitySessionDTO }[] = []
  const covered = new Set<string>()
  courts.forEach((_, col) => {
    let r = 0
    while (r < times.length) {
      const sid = cellSessions[r][col]
      const ev = sid ? events.get(sid) : undefined
      if (cells[r][col] === 'EVENT' && ev) {
        let span = 1
        while (r + span < times.length && cellSessions[r + span][col] === sid) span++
        blocks.push({ col, row: r, span, event: ev })
        for (let k = 0; k < span; k++) covered.add(`${r + k}:${col}`)
        r += span
      } else r++
    }
  })

  return (
    <div
      className={cn(
        'matrix-scroll max-h-[70vh] overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-white transition-opacity',
        busy && 'opacity-60',
      )}
    >
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `96px repeat(${courts.length}, minmax(104px, 1fr))`,
          gridTemplateRows: `auto repeat(${times.length}, minmax(4rem, auto))`,
        }}
        role="grid"
        aria-label="場地與時段表"
      >
        {/* 表頭：捲動時固定在上方 */}
        <div
          className="sticky left-0 top-0 z-30 border-b border-r border-[rgb(var(--border))] bg-white px-2 py-2.5 text-[11px] font-medium text-muted"
          style={{ gridRow: 1, gridColumn: 1 }}
        >
          <div className="text-[13px] font-bold text-brand-900">{shortDateLabel(data.date)}</div>
          <div className="text-[11px] font-normal">場地費{unit}</div>
        </div>
        {courts.map((court, col) => (
          <div
            key={court.id}
            role="columnheader"
            className="sticky top-0 z-20 border-b border-[rgb(var(--border))] bg-white px-2 py-2.5 text-center"
            style={{ gridRow: 1, gridColumn: col + 2 }}
          >
            <div className="text-[13px] font-semibold leading-tight">{court.name}</div>
            <div className="mt-0.5 text-[10px] text-muted">{courtEnvLabel(court)}</div>
          </div>
        ))}

        {/* 時段欄：捲動時固定在左側。時間 16–18px，尖峰／離峰標籤 13–14px、字重 600，有文字不只靠顏色 */}
        {times.map((time, row) => (
          <div
            key={time.start}
            role="rowheader"
            className="sticky left-0 z-10 flex flex-col items-start justify-center gap-1 border-b border-r border-[rgb(var(--border))] bg-white px-2.5 py-2"
            style={{ gridRow: row + 2, gridColumn: 1 }}
          >
            <div className="text-[17px] font-semibold leading-none tabular">
              {time.nextDay && <span className="mr-1 text-[11px] font-medium text-muted">翌日</span>}
              {time.label.split('–')[0]}
            </div>
            <span
              className={cn(
                'inline-block rounded-md px-2 py-[3px] text-[13px] font-semibold leading-none',
                time.kind === 'PEAK' ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-900',
              )}
            >
              {time.rateName}
            </span>
          </div>
        ))}

        {/* 一般格子 */}
        {times.map((time, row) =>
          courts.map((court, col) => {
            if (covered.has(`${row}:${col}`)) return null
            const state = cells[row][col]
            const key = `${court.id}@${time.start}`
            const isPending = pendingKey === key
            const interactive = state === 'AVAILABLE' || state === 'SELECTED'
            const Icon = CELL_ICON[state]
            return (
              <div
                key={key}
                className="border-b border-[rgb(var(--border))] p-1"
                style={{ gridRow: row + 2, gridColumn: col + 2 }}
              >
                <button
                  type="button"
                  role="gridcell"
                  disabled={!interactive || isPending}
                  aria-pressed={state === 'SELECTED'}
                  aria-label={`${court.name} ${time.nextDay ? '翌日 ' : ''}${time.label} ${
                    state === 'AVAILABLE'
                      ? `可預約，場地費 ${time.price} 元${unit}`
                      : state === 'SELECTED'
                        ? '已選取'
                        : (CELL_TEXT[state] ?? '')
                  }`}
                  onClick={() => interactive && onToggle(court.id, time.start, state)}
                  className={cn(
                    'flex h-full min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-all active:scale-[.97]',
                    CELL_STYLE[state],
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : state === 'SELECTED' ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden />
                      <span className="text-[11px] tabular">已選 NT${time.price}</span>
                    </>
                  ) : state === 'AVAILABLE' ? (
                    <>
                      <span className="tabular text-[14px] font-semibold">NT${time.price}</span>
                      <span className="text-[10px] text-[#191D1A]/55">每場地・{unit.replace('每', '')}</span>
                    </>
                  ) : (
                    <>
                      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
                      <span className="px-1 text-center text-[11px] leading-tight">{CELL_TEXT[state]}</span>
                    </>
                  )}
                </button>
              </div>
            )
          }),
        )}

        {/* 活動區塊 */}
        {blocks.map((b) => (
          <div
            key={`${b.event.id}:${b.col}`}
            className="border-b border-[rgb(var(--border))] p-1"
            style={{ gridRow: `${b.row + 2} / span ${b.span}`, gridColumn: b.col + 2 }}
          >
            <button
              type="button"
              onClick={() => onOpenEvent(b.event.id)}
              aria-label={`活動：${b.event.title}，${b.event.timeLabel}，${b.event.price > 0 ? `每${b.event.unitLabel} ${b.event.price} 元` : '免費'}，${b.event.stateLabel}${b.event.state === 'OPEN' ? `，剩餘 ${b.event.remaining} 位` : ''}，查看活動`}
              className={cn(
                'flex h-full w-full flex-col items-start gap-0.5 rounded-lg border-l-4 border-l-brand-600 px-2 py-1.5 text-left transition-colors hover:bg-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600',
                CELL_STYLE.EVENT,
              )}
            >
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                <CalendarHeart className="h-3 w-3" aria-hidden />
                活動
              </span>
              <span className="line-clamp-2 text-[12px] font-extrabold leading-tight">{b.event.title}</span>
              <span className="text-[11px] tabular">{b.event.timeLabel}</span>
              <span className="text-[11px] font-semibold tabular">
                {b.event.price > 0 ? `NT$${b.event.price}／${b.event.unitLabel}` : '免費'}
              </span>
              <span className={cn('text-[11px] font-semibold', b.event.state === 'FULL' && 'text-rose-700')}>
                {b.event.state === 'OPEN' ? `剩餘 ${b.event.remaining} 位` : b.event.state === 'FULL' ? '已額滿' : b.event.stateLabel}
              </span>
              <span className="text-[10px] text-brand-900/70">活動使用中・不可租場</span>
              <span className="mt-auto text-[11px] font-bold underline underline-offset-2">{b.event.state === 'OPEN' ? '查看活動／報名' : '查看活動'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const LEGEND: { state: SlotState; label: string; Icon?: typeof Lock }[] = [
  { state: 'AVAILABLE', label: '可預約（場地費每場地）' },
  { state: 'SELECTED', label: '已選取', Icon: Check },
  { state: 'EVENT', label: '活動使用中（可報名，不可租場）', Icon: CalendarHeart },
  { state: 'BOOKED', label: '已預約', Icon: Lock },
  { state: 'HELD', label: '他人保留中', Icon: Clock },
  { state: 'MAINTENANCE', label: '清潔維護・暫不開放', Icon: Wrench },
  { state: 'BLOCKED', label: '封場', Icon: ShieldBan },
  { state: 'RESERVED', label: '活動占用・不開放租借', Icon: CalendarHeart },
  { state: 'STARTED', label: '已開始', Icon: PlayCircle },
  { state: 'CUTOFF', label: '已截止', Icon: Hourglass },
]

export function MatrixLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
      {LEGEND.map(({ state, label, Icon }) => (
        <li key={state} className="flex items-center gap-1.5">
          <span className={cn('grid h-4 w-4 place-items-center rounded border', CELL_STYLE[state].replace(/cursor-[\w-]+|hover:\S+/g, ''))}>
            {Icon && <Icon className="h-2.5 w-2.5" aria-hidden />}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
