import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { getAvailability } from '@/lib/availability'
import { dateRange, isValidDateString, taipeiDateString } from '@/lib/time'
import { AdminScheduleClient } from './schedule-client'

export const dynamic = 'force-dynamic'

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
  if (!venue) return <p className="text-sm text-muted">尚未建立場館。</p>

  const today = taipeiDateString()
  const date = sp.date && isValidDateString(sp.date) ? sp.date : today
  const data = await getAvailability(venue.slug, date, null)

  return <AdminScheduleClient data={data} date={date} dates={dateRange(venue.bookAheadDays + 1, today)} />
}
