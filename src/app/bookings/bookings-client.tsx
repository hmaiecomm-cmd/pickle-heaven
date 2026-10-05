'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarX2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { BookingStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateFull } from '@/lib/time'
import { cn, ntd } from '@/lib/utils'

export interface BookingCardData {
  id: string
  code: string
  status: string
  playDate: string
  venueName: string
  total: number
  slots: { courtName: string; label: string }[]
}

type TabKey = 'upcoming' | 'past' | 'cancelled'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: '即將到來' },
  { key: 'past', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

export function BookingsClient({
  upcoming,
  past,
  cancelled,
}: {
  upcoming: BookingCardData[]
  past: BookingCardData[]
  cancelled: BookingCardData[]
}) {
  const [tab, setTab] = React.useState<TabKey>('upcoming')
  const data = { upcoming, past, cancelled }[tab]
  const counts = { upcoming: upcoming.length, past: past.length, cancelled: cancelled.length }

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 rounded-xl surface-2 p-1"
        role="tablist"
        aria-label="預約狀態篩選"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === t.key ? 'surface shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]',
            )}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="ml-1 text-xs tabular opacity-70">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl surface-2 text-[rgb(var(--fg-muted))]">
            <CalendarX2 className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm text-muted">
            {tab === 'upcoming' ? '目前沒有即將到來的預約' : tab === 'past' ? '還沒有完成的預約' : '沒有已取消的預約'}
          </p>
          {tab === 'upcoming' && (
            <Button asChild className="mt-5">
              <Link href="/booking">立即預約場地</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b.id}>
              <Link href={`/bookings/${b.id}`} className="block">
                <Card className="transition-shadow hover:shadow-pop">
                  <CardContent className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{formatDateFull(b.playDate)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{b.venueName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <BookingStatusBadge status={b.status} />
                        <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" aria-hidden />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {b.slots.slice(0, 4).map((s, i) => (
                        <span
                          key={i}
                          className="rounded-lg surface-2 px-2 py-1 text-[11px] text-muted tabular"
                        >
                          {s.courtName} {s.label}
                        </span>
                      ))}
                      {b.slots.length > 4 && (
                        <span className="rounded-lg surface-2 px-2 py-1 text-[11px] text-muted">
                          +{b.slots.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-2.5">
                      <span className="text-[11px] text-muted tabular">{b.code}</span>
                      <span className="text-sm font-semibold tabular">{ntd(b.total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
