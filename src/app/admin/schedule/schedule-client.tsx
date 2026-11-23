'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { DateStrip } from '@/components/booking/date-strip'
import { cn } from '@/lib/utils'
import { formatDateFull, formatRange } from '@/lib/time'
import type { AvailabilityDTO, SlotState } from '@/lib/types'
import type { ScheduleCellDetail } from '@/server/schedule-admin'

const CELL: Record<SlotState, { label: string; tone: string; open: boolean }> = {
  AVAILABLE: { label: '可預約', tone: 'bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200 hover:ring-[#7cb342]', open: true },
  SELECTED: { label: '可預約', tone: 'bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200', open: true },
  BOOKED: { label: '已預約', tone: 'bg-[#1f4d34] text-white hover:bg-[#2a6044]', open: true },
  HELD: { label: '付款中', tone: 'bg-amber-100 text-amber-900 hover:bg-amber-200', open: true },
  BLOCKED: { label: '封場', tone: 'bg-zinc-700 text-white hover:bg-zinc-600', open: true },
  MAINTENANCE: { label: '清潔維護', tone: 'bg-sky-100 text-sky-900 hover:bg-sky-200', open: true },
  EVENT: { label: '活動', tone: 'bg-violet-100 text-violet-900 hover:bg-violet-200', open: true },
  RESERVED: { label: '場館保留', tone: 'bg-violet-50 text-violet-700', open: true },
  STARTED: { label: '已開始', tone: 'bg-zinc-50 text-zinc-400', open: true },
  CUTOFF: { label: '已截止', tone: 'bg-zinc-50 text-zinc-400', open: true },
  PAST: { label: '已結束', tone: 'bg-zinc-50 text-zinc-300', open: true },
  CLOSED: { label: '未開放', tone: 'bg-zinc-50 text-zinc-300', open: true },
}

type Picked = { courtId: string; courtName: string; start: number; end: number; state: SlotState; sessionId: string | null }

/** 智慧排程：以預約為主的場地時段總覽。封場的新增與解除統一在「維護與封場」。 */
export function AdminScheduleClient({
  data,
  details,
  date,
  dates,
  canManageCourts,
  canViewOrders,
}: {
  data: AvailabilityDTO
  details: Record<string, ScheduleCellDetail>
  date: string
  dates: string[]
  canManageCourts: boolean
  canViewOrders: boolean
}) {
  const router = useRouter()
  const [picked, setPicked] = React.useState<Picked | null>(null)
  const eventTitle = new Map(data.events.map((e) => [e.id, e.title]))

  const count = (states: SlotState[]) => data.cells.flat().filter((s) => states.includes(s)).length
  const summary = [
    { label: '已預約', value: count(['BOOKED']), dot: 'bg-[#1f4d34]' },
    { label: '付款中', value: count(['HELD']), dot: 'bg-amber-400' },
    { label: '可預約', value: count(['AVAILABLE']), dot: 'bg-white ring-1 ring-zinc-300' },
    { label: '活動', value: count(['EVENT']), dot: 'bg-violet-300' },
    { label: '封場／維護', value: count(['BLOCKED', 'MAINTENANCE']), dot: 'bg-zinc-600' },
  ]

  const cellText = (state: SlotState, detail: ScheduleCellDetail | undefined, sessionId: string | null) => {
    if (state === 'BOOKED' && detail?.kind === 'BOOKING') return detail.contactName ?? '已預約'
    if (state === 'MAINTENANCE' && detail?.kind === 'MAINTENANCE') return detail.planName
    if (state === 'BLOCKED' && detail?.kind === 'BLOCK') return `封場・${detail.note}`
    if (state === 'EVENT' && sessionId) return eventTitle.get(sessionId) ?? '活動'
    return CELL[state].label
  }

  const detail = picked ? details[`${picked.courtId}@${picked.start}`] : undefined
  const blockHref = picked
    ? `/admin/maintenance?tab=manual&court=${encodeURIComponent(picked.courtId)}&date=${date}&start=${picked.start}`
    : '#'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">智慧排程</h1>
        <p className="mt-1 text-sm text-muted">點選時段查看預約；封場與清潔維護請到「維護與封場」。</p>
      </div>

      <DateStrip dates={dates} value={date} onChange={(next) => router.push(`/admin/schedule?date=${next}`)} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{formatDateFull(date)}</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label="當日統計（時段格數）">
            {summary.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} aria-hidden />
                {s.label} <span className="font-semibold text-[rgb(var(--fg))]">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {data.times.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{data.allEnded ? '今天的時段都已結束。' : '這一天沒有開放的時段。'}</p>
        ) : (
          <div role="grid" aria-label="場地時段表" className="grid gap-1.5" style={{ gridTemplateColumns: `4.5rem repeat(${data.courts.length}, minmax(0, 1fr))` }}>
            <div role="row" className="contents">
              <span role="columnheader" />
              {data.courts.map((c) => (
                <span key={c.id} role="columnheader" className="pb-1 text-center text-xs font-semibold text-zinc-600">
                  {c.name}
                </span>
              ))}
            </div>
            {data.times.map((t, ti) => (
              <div key={t.start} role="row" className="contents">
                <span role="rowheader" className="flex h-11 flex-col justify-center text-[11px] leading-tight text-zinc-500">
                  {formatRange(t.start, t.end).split('–')[0]}
                  {t.nextDay && <span className="text-[10px]">翌日</span>}
                </span>
                {data.courts.map((c, ci) => {
                  const state = data.cells[ti][ci]
                  const sessionId = data.cellSessions[ti]?.[ci] ?? null
                  const d = details[`${c.id}@${t.start}`]
                  const text = cellText(state, d, sessionId)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="gridcell"
                      disabled={!CELL[state].open}
                      onClick={() => setPicked({ courtId: c.id, courtName: c.name, start: t.start, end: t.end, state, sessionId })}
                      aria-label={`${c.name} ${t.label}：${text}`}
                      className={cn('h-11 min-w-0 truncate rounded-lg px-2 text-left text-xs font-medium transition-colors disabled:cursor-default', CELL[state].tone)}
                    >
                      {text}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
        {data.hiddenEndedRows > 0 && <p className="mt-2 text-[11px] text-muted">今日已結束的 {data.hiddenEndedRows} 個時段已隱藏。</p>}
      </section>

      <Sheet open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent title={picked ? `${picked.courtName}・${formatRange(picked.start, picked.end)}` : ''} description={formatDateFull(date)}>
          {picked && (
            <div className="space-y-4 text-sm">
              <p>
                <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold', CELL[picked.state].tone)}>{CELL[picked.state].label}</span>
              </p>

              {detail?.kind === 'BOOKING' && (
                <dl className="grid grid-cols-[5rem_1fr] gap-y-2">
                  <dt className="text-muted">預約人</dt>
                  <dd>{detail.contactName ?? '—'}</dd>
                  <dt className="text-muted">訂單編號</dt>
                  <dd className="font-mono">{detail.bookingCode ?? '—'}</dd>
                  <dt className="text-muted">訂單狀態</dt>
                  <dd>{detail.bookingStatus}</dd>
                  {detail.contactPhone !== undefined && (
                    <>
                      <dt className="text-muted">電話</dt>
                      <dd>{detail.contactPhone}</dd>
                      <dt className="text-muted">訂單金額</dt>
                      <dd>NT$ {detail.total?.toLocaleString()}</dd>
                    </>
                  )}
                </dl>
              )}
              {detail?.kind === 'HOLD' && <p className="text-muted">客人已放入購物車、尚未完成付款；逾時未付款會自動釋放。</p>}
              {detail?.kind === 'BLOCK' && <p>封場原因：{detail.note}</p>}
              {detail?.kind === 'MAINTENANCE' && <p>維護排程：{detail.planName}</p>}
              {(detail?.kind === 'BLOCK' || detail?.kind === 'MAINTENANCE') && <p className="text-muted">照明：{detail.lighting ? '開啟該場燈與風扇' : '不開啟'}</p>}
              {picked.state === 'AVAILABLE' && <p className="text-muted">這個時段目前開放預約。</p>}
              {picked.state === 'CUTOFF' && <p className="text-muted">已超過線上預約截止時間。</p>}

              <div className="flex flex-col gap-2">
                {detail?.kind === 'BOOKING' && detail.bookingCode && canViewOrders && (
                  <Button asChild>
                    <Link href={`/admin/bookings?q=${encodeURIComponent(detail.bookingCode)}`}>查看訂單</Link>
                  </Button>
                )}
                {picked.state === 'EVENT' && picked.sessionId && (
                  <Button asChild>
                    <Link href={`/admin/sessions/${picked.sessionId}`}>查看活動場次</Link>
                  </Button>
                )}
                {(picked.state === 'AVAILABLE' || picked.state === 'CUTOFF') && canManageCourts && (
                  <Button asChild variant="secondary">
                    <Link href={blockHref}>到維護與封場新增封場</Link>
                  </Button>
                )}
                {(picked.state === 'BLOCKED' || picked.state === 'MAINTENANCE') && (
                  <Button asChild variant="secondary">
                    <Link href={picked.state === 'BLOCKED' ? '/admin/maintenance?tab=manual' : '/admin/maintenance'}>到維護與封場管理</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
