import type { Metadata } from 'next'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { zonedParts } from '@/lib/timezone'
import { Card, CardContent } from '@/components/ui/card'
import { SessionCard, type SessionCardData } from '@/components/sessions/session-card'

export const metadata: Metadata = { title: '球敘' }
export const dynamic = 'force-dynamic'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const STATUS_LABEL: Record<SessionStatus, { text: string; tone: SessionCardData['statusTone'] }> = {
  DRAFT: { text: '草稿', tone: 'neutral' },
  SCHEDULED: { text: '尚未開放', tone: 'neutral' },
  OPEN: { text: '開放報名', tone: 'success' },
  FULL: { text: '已額滿', tone: 'danger' },
  LOCKED: { text: '已鎖定', tone: 'warn' },
  PLAYING: { text: '進行中', tone: 'brand' },
  COMPLETED: { text: '已結束', tone: 'neutral' },
  CANCELLED: { text: '已取消', tone: 'neutral' },
}

/** 報名按鈕停用時顯示的原因，讓玩家知道為什麼不能按。 */
function actionHintFor(
  status: SessionStatus,
  now: Date,
  bookingOpenAt: Date,
  bookingCloseAt: Date,
  waitlistEnabled: boolean,
  isFull: boolean,
): string | null {
  if (status === SessionStatus.CANCELLED) return '這場已取消'
  if (status === SessionStatus.COMPLETED) return '這場已結束'
  if (status === SessionStatus.PLAYING) return '進行中'
  if (status === SessionStatus.LOCKED) return '名單已鎖定'
  if (status === SessionStatus.DRAFT || now < bookingOpenAt) return '報名尚未開放'
  if (now >= bookingCloseAt) return '報名已截止'
  if (isFull && !waitlistEnabled) return '已額滿'
  return null
}

function fmtDate(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）`
}

function fmtTime(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/**
 * 一次顯示接下來幾場球敘。
 *
 * 以「場數」而非「天數」為準：球敘間隔可能是每週、每兩週或一週多場，
 * 用天數會讓畫面上的數量隨頻率忽多忽少。
 */
const DISPLAY_COUNT = 8

export default async function SessionsPage() {
  const user = await getSessionUser()
  const now = new Date()

  const sessions = await prisma.session.findMany({
    where: { status: { not: SessionStatus.CANCELLED }, endAt: { gte: now } },
    orderBy: { startAt: 'asc' },
    take: DISPLAY_COUNT,
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      registrations: {
        where: { status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
        orderBy: [{ waitlistPosition: 'asc' }, { registeredAt: 'asc' }],
        select: {
          userId: true,
          status: true,
          waitlistPosition: true,
          user: { select: { displayName: true } },
        },
      },
    },
  })

  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">
目前沒有即將到來的球敘。
          </CardContent>
        </Card>
      </div>
    )
  }

  const cards: SessionCardData[] = sessions.map((s) => {
    const tz = s.venue.timezone
    const confirmed = s.registrations.filter((r) => r.status === RegistrationStatus.CONFIRMED)
    const waitlist = s.registrations.filter((r) => r.status === RegistrationStatus.WAITLISTED)
    const publicSpots = Math.max(0, s.capacity - s.reservedCapacity)
    const isFull = confirmed.length >= publicSpots

    const mine = user ? s.registrations.find((r) => r.userId === user.id) : undefined
    const myStatus =
      mine?.status === RegistrationStatus.CONFIRMED
        ? 'CONFIRMED'
        : mine?.status === RegistrationStatus.WAITLISTED
          ? 'WAITLISTED'
          : 'NONE'

    const hint = actionHintFor(
      s.status,
      now,
      s.bookingOpenAt,
      s.bookingCloseAt,
      s.waitlistEnabled,
      isFull,
    )

    return {
      id: s.id,
      title: s.title,
      dateLabel: fmtDate(s.startAt, tz),
      timeLabel: `${fmtTime(s.startAt, tz)}–${fmtTime(s.endAt, tz)}`,
      placeLabel: s.court?.name ?? s.venue.name,
      skillLabel:
        s.skillLevelMin != null && s.skillLevelMax != null
          ? `${s.skillLevelMin.toFixed(1)}–${s.skillLevelMax.toFixed(1)}`
          : null,
      price: s.price,
      publicSpots,
      reservedCapacity: s.reservedCapacity,
      confirmedCount: confirmed.length,
      waitlistCount: waitlist.length,
      statusLabel: STATUS_LABEL[s.status].text,
      statusTone: STATUS_LABEL[s.status].tone,
      bookingOpenLabel: `${fmtDate(s.bookingOpenAt, tz)} ${fmtTime(s.bookingOpenAt, tz)}`,
      cancelDeadlineLabel: `${fmtDate(s.cancelDeadline, tz)} ${fmtTime(s.cancelDeadline, tz)}`,
      isFull,
      canAct: hint === null,
      actionHint: hint,
      waitlistEnabled: s.waitlistEnabled,
      myStatus,
      myWaitlistPosition: mine?.waitlistPosition ?? null,
      roster: confirmed.map((r) => r.user.displayName),
    }
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">🏓 球敘</h1>
        <p className="text-xs text-muted">
顯示接下來 {DISPLAY_COUNT} 場。報名於開打前一週開放，額滿可候補，有人取消時自動遞補。
        </p>
      </header>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {cards.map((data) => (
          <SessionCard key={data.id} data={data} />
        ))}
      </div>
    </div>
  )
}
