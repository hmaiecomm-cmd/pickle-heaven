import type { Metadata } from 'next'
import Link from 'next/link'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { zonedParts } from '@/lib/timezone'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: '球敘管理' }
export const dynamic = 'force-dynamic'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'brand'

const SESSION_STATUS: Record<SessionStatus, { text: string; tone: Tone }> = {
  DRAFT: { text: '草稿', tone: 'neutral' },
  SCHEDULED: { text: '尚未開放', tone: 'neutral' },
  OPEN: { text: '開放報名', tone: 'success' },
  FULL: { text: '已額滿', tone: 'danger' },
  LOCKED: { text: '已鎖定', tone: 'warn' },
  PLAYING: { text: '進行中', tone: 'brand' },
  COMPLETED: { text: '已結束', tone: 'neutral' },
  CANCELLED: { text: '已取消', tone: 'neutral' },
}

function fmtDateTime(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  const t = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）${t}`
}

export default async function AdminSessionsPage() {
  await requireAdmin()

  const sessions = await prisma.session.findMany({
    // 已軟刪除的場次不列出（詳情頁也會回 404）
    where: { deletedAt: null },
    orderBy: { startAt: 'asc' },
    take: 60,
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      registrations: {
        where: {
          status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] },
        },
        select: { status: true },
      },
    },
  })

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted">
          尚未有任何球敘。請先建立範本並執行{' '}
          <code className="rounded surface-2 px-1.5 py-0.5">/api/cron/sessions</code> 產生場次。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">球敘管理</h1>
          <p className="mt-0.5 text-xs text-muted">共 {sessions.length} 場，點選可管理名單</p>
        </div>
        <Link href="/admin/templates" className="text-xs text-brand-600 hover:underline">
          週期性範本 →
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-[rgb(var(--border))]">
            {sessions.map((s) => {
              const confirmed = s.registrations.filter(
                (r) => r.status === RegistrationStatus.CONFIRMED,
              ).length
              const waiting = s.registrations.filter(
                (r) => r.status === RegistrationStatus.WAITLISTED,
              ).length
              const publicSpots = Math.max(0, s.capacity - s.reservedCapacity)
              const label = SESSION_STATUS[s.status]

              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fmtDateTime(s.startAt, s.venue.timezone)}　{s.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {s.court?.name ?? s.venue.name}
                        {waiting > 0 ? `　候補 ${waiting} 人` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">
                      {confirmed} / {publicSpots}
                    </span>
                    <Badge variant={label.tone}>{label.text}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
