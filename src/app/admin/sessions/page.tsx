import type { Metadata } from 'next'
import Link from 'next/link'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { zonedParts } from '@/lib/timezone'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateSessionButton } from './create-session'

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

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  await requireAdmin()
  const { create } = await searchParams
  const autoOpen = create === '1'
  // 單次球敘建在第一個啟用中的場館（與 adminCreateSession 相同的選法）
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { timezone: true } })
  const timezone = venue?.timezone ?? 'Asia/Taipei'

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
        <CardContent className="space-y-4 py-12 text-center text-sm text-muted">
          <p>尚未有任何球敘。可以新增一場單次球敘，或建立週期性範本讓排程自動產生場次。</p>
          <div className="flex justify-center gap-3">
            <CreateSessionButton timezone={timezone} autoOpen={autoOpen} />
            <Link href="/admin/templates" className="inline-flex h-9 items-center rounded-xl border border-[rgb(var(--border))] px-3 text-sm hover:surface-2">
              週期性範本
            </Link>
          </div>
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
        <div className="flex items-center gap-3">
          <Link href="/admin/templates" className="text-xs text-brand-600 hover:underline">
            週期性範本 →
          </Link>
          <CreateSessionButton timezone={timezone} autoOpen={autoOpen} />
        </div>
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
