import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { Forbidden } from '@/components/admin/page-bits'
import { CourtsClient } from './courts-client'
import { VenueRulesCard } from './venue-rules'

export const metadata: Metadata = { title: '場地設定' }

export const dynamic = 'force-dynamic'

export default async function CourtsPage() {
  const ctx = await pagePermission('courts')
  if (ctx === 'forbidden') return <Forbidden />
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, openMinute: true, closeMinute: true, slotMinutes: true, bookAheadDays: true, holdMinutes: true, bookingCutoffMinutes: true },
  })
  return (
    <CourtsClient canManage={can(ctx.role, 'courts.manage')}>
      {venue ? <VenueRulesCard venue={venue} canEdit={can(ctx.role, 'settings')} /> : <p className="text-sm text-muted">尚未建立場館。</p>}
    </CourtsClient>
  )
}
