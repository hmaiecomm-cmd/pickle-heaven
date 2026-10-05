import type { Metadata } from 'next'
import Link from 'next/link'
import { getSessionUser } from '@/lib/session'
import { listUserBookings } from '@/server/booking-service'
import { taipeiToUtc, formatRange } from '@/lib/time'
import { BookingsClient, type BookingCardData } from './bookings-client'
import { LoginPrompt } from '@/components/login-prompt'

export const metadata: Metadata = { title: '我的預約' }
export const dynamic = 'force-dynamic'

export default async function BookingsPage() {
  const user = await getSessionUser()

  if (!user) {
    return (
      <LoginPrompt
        title="登入後查看預約紀錄"
        description="使用 LINE 登入即可查看您的所有場地預約與付款狀態。"
      />
    )
  }

  const { upcoming, past, cancelled } = await listUserBookings(user.id)

  const toCard = (b: Awaited<ReturnType<typeof listUserBookings>>['upcoming'][number]): BookingCardData => {
    const base = taipeiToUtc(b.playDate, 0).getTime()
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      playDate: b.playDate,
      venueName: b.venue.name,
      total: b.total,
      slots: b.items.map((it) => ({
        courtName: it.courtName,
        label: formatRange(
          Math.round((it.startsAt.getTime() - base) / 60_000),
          Math.round((it.endsAt.getTime() - base) / 60_000),
        ),
      })),
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">我的預約</h1>
        <Link href="/booking" className="text-xs font-medium text-brand-600 hover:underline">
          + 新增預約
        </Link>
      </div>

      <BookingsClient
        upcoming={upcoming.map(toCard)}
        past={past.map(toCard)}
        cancelled={cancelled.map(toCard)}
      />
    </div>
  )
}
