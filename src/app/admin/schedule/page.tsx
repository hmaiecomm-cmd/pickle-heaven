import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden } from '@/components/admin/page-bits'
import { getAvailability } from '@/lib/availability'
import { dateRange, isValidDateString, taipeiDateString } from '@/lib/time'
import { getScheduleDetails } from '@/server/schedule-admin'
import { AdminScheduleClient } from './schedule-client'

export const metadata: Metadata = { title: '智慧排程' }
export const dynamic = 'force-dynamic'

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const ctx = await pagePermission('courts')
  if (ctx === 'forbidden') return <Forbidden />
  const sp = await searchParams

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
  if (!venue) return <p className="text-sm text-muted">尚未建立場館。</p>

  const today = taipeiDateString()
  const date = sp.date && isValidDateString(sp.date) ? sp.date : today
  const canViewOrders = can(ctx.role, 'bookings')
  const [data, details] = await Promise.all([
    getAvailability(venue.slug, date, null),
    getScheduleDetails(venue.id, date, venue.slotMinutes, { includeContact: canViewOrders }),
  ])

  return (
    <AdminScheduleClient
      data={data}
      details={details}
      date={date}
      dates={dateRange(venue.bookAheadDays + 1, today)}
      canManageCourts={can(ctx.role, 'courts.manage')}
      canViewOrders={canViewOrders}
    />
  )
}
