import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { zonedParts } from '@/lib/timezone'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RosterClient, type RosterRow } from './roster-client'

export const metadata: Metadata = { title: '球敘名單' }
export const dynamic = 'force-dynamic'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'brand'

const STATUS: Record<SessionStatus, { text: string; tone: Tone }> = {
  DRAFT: { text: '草稿', tone: 'neutral' },
  SCHEDULED: { text: '尚未開放', tone: 'neutral' },
  OPEN: { text: '開放報名', tone: 'success' },
  FULL: { text: '已額滿', tone: 'danger' },
  LOCKED: { text: '已鎖定', tone: 'warn' },
  PLAYING: { text: '進行中', tone: 'brand' },
  COMPLETED: { text: '已結束', tone: 'neutral' },
  CANCELLED: { text: '已取消', tone: 'neutral' },
}

function fmt(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  const t = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）${t}`
}

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if ((await pagePermission('activities.view')) === 'forbidden') return <Forbidden />
  const { id } = await params

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      registrations: {
        where: {
          status: {
            in: [
              RegistrationStatus.CONFIRMED,
              RegistrationStatus.WAITLISTED,
              RegistrationStatus.COMPLETED,
              RegistrationStatus.NO_SHOW,
            ],
          },
        },
        orderBy: [{ waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
        include: { user: { select: { displayName: true } } },
      },
      snapshots: {
        where: { snapshotType: 'FINAL_ROSTER' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  })

  if (!session || session.deletedAt) notFound()

  const tz = session.venue.timezone
  const toRow = (r: (typeof session.registrations)[number]): RosterRow => ({
    registrationId: r.id,
    name: r.user.displayName,
    status: r.status as RosterRow['status'],
    waitlistPosition: r.waitlistPosition,
    addedByOrganizer: r.addedByOrganizer,
  })

  // 出席／未到都算在正取名單上，讓主辦者賽後仍看得到完整名單
  const confirmed = session.registrations
    .filter((r) => r.status !== RegistrationStatus.WAITLISTED)
    .map(toRow)
  const waitlist = session.registrations
    .filter((r) => r.status === RegistrationStatus.WAITLISTED)
    .map(toRow)

  const label = STATUS[session.status]
  const publicSpots = Math.max(0, session.capacity - session.reservedCapacity)

  return (
    <div className="space-y-4">
      <Link
        href="/admin/sessions"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        回球敘列表
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{session.title}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {fmt(session.startAt, tz)}–
                {`${String(zonedParts(session.endAt, tz).hour).padStart(2, '0')}:${String(
                  zonedParts(session.endAt, tz).minute,
                ).padStart(2, '0')}`}
              </p>
            </div>
            <Badge variant={label.tone}>{label.text}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Row label="場地" value={session.court?.name ?? session.venue.name} />
            <Row label="名額" value={`${publicSpots} 席（另保留 ${session.reservedCapacity}）`} />
            <Row label="報名開放" value={fmt(session.bookingOpenAt, tz)} />
            <Row label="報名截止" value={fmt(session.bookingCloseAt, tz)} />
            <Row label="取消截止" value={fmt(session.cancelDeadline, tz)} />
            <Row
              label="最終名單"
              value={
                session.snapshots[0]
                  ? `已產生 ${fmt(session.snapshots[0].createdAt, tz)}`
                  : '尚未產生'
              }
            />
          </dl>

          {session.cancelReason ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              取消原因：{session.cancelReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RosterClient
        sessionId={session.id}
        confirmed={confirmed}
        waitlist={waitlist}
        settings={{
          title: session.title,
          capacity: session.capacity,
          reservedCapacity: session.reservedCapacity,
          price: session.price,
          waitlistEnabled: session.waitlistEnabled,
          autoPromote: session.autoPromote,
          allowPostLockReplacement: session.allowPostLockReplacement,
        }}
        canLock={
          session.status === SessionStatus.OPEN ||
          session.status === SessionStatus.FULL ||
          session.status === SessionStatus.SCHEDULED
        }
        canCancel={session.status !== SessionStatus.CANCELLED}
        isPast={session.startAt <= new Date()}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
