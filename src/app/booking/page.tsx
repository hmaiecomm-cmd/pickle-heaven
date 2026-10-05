import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getAvailability, getCart } from '@/lib/availability'
import { getCartToken } from '@/lib/session'
import { dateRange, isValidDateString, taipeiDateString } from '@/lib/time'
import { BookingBoard } from '@/components/booking/booking-board'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: '場地預約' }
export const dynamic = 'force-dynamic'

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; venue?: string }>
}) {
  const sp = await searchParams

  const venue = sp.venue
    ? await prisma.venue.findFirst({ where: { slug: sp.venue, active: true } })
    : await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })

  if (!venue) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted">
            尚未設定任何場館。請先執行 <code className="rounded surface-2 px-1.5 py-0.5">npm run db:seed</code> 建立示範資料。
          </p>
        </CardContent>
      </Card>
    )
  }

  const today = taipeiDateString()
  const date = sp.date && isValidDateString(sp.date) ? sp.date : today
  const dates = dateRange(venue.bookAheadDays + 1, today)

  const cartToken = await getCartToken()
  const [data, cart] = await Promise.all([
    getAvailability(venue.slug, date, cartToken),
    getCart(cartToken),
  ])

  return (
    <BookingBoard slug={venue.slug} dates={dates} initialDate={date} initialData={data} initialCart={cart} />
  )
}
