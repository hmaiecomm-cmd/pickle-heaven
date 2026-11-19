import { notFound } from 'next/navigation'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { zonedParts } from '@/lib/timezone'
import { RosterClient, type RosterRow } from '@/app/admin/sessions/[id]/roster-client'
import { SessionDetailPanelClient } from './session-detail-panel-client'

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

export async function SessionDetailPanel({ sessionId }: { sessionId: string }) {
  const [session, activityItems] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
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
    }),
    prisma.bookingActivityItem.findMany({
      where: { sessionId },
      include: {
        booking: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    }),
  ])

  if (!session || session.deletedAt) notFound()

  const tz = session.venue.timezone
  const toRow = (r: (typeof session.registrations)[number]): RosterRow => ({
    registrationId: r.id,
    name: r.user.displayName,
    status: r.status as RosterRow['status'],
    waitlistPosition: r.waitlistPosition,
    addedByOrganizer: r.addedByOrganizer,
  })

  const confirmed = session.registrations
    .filter((r) => r.status !== RegistrationStatus.WAITLISTED)
    .map(toRow)
  const waitlist = session.registrations
    .filter((r) => r.status === RegistrationStatus.WAITLISTED)
    .map(toRow)

  const label = STATUS[session.status]
  const publicSpots = Math.max(0, session.capacity - session.reservedCapacity)

  // 獲取該場次的訂單列表（去重）
  const bookingMap = new Map<string, typeof activityItems[number]['booking']>()
  activityItems.forEach((item) => {
    if (!bookingMap.has(item.booking.id)) {
      bookingMap.set(item.booking.id, item.booking)
    }
  })

  const bookings = Array.from(bookingMap.values()).map((b) => ({
    id: b.id,
    code: b.code,
    userName: b.contactName,
    email: b.user.email,
    phone: b.contactPhone,
    total: b.total,
    status: b.status,
    createdAt: b.createdAt,
    paymentsCount: 0,
    refundsCount: 0,
  }))

  const sessionDetailCard = (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{session.title}</h2>
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
  )

  const rosterClient = (
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
  )

  return (
    <SessionDetailPanelClient
      sessionId={session.id}
      sessionTitle={session.title}
      sessionDetailCard={sessionDetailCard}
      rosterClient={rosterClient}
      bookings={bookings}
      perms={{ refund: false, invoice: false, access: false, accessGrant: false }}
    />
  )
}
