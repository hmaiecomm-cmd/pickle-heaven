import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { formatRange, taipeiToUtc } from '@/lib/time'
import { AdminBookingsClient, type AdminBookingRow } from './bookings-client'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; date?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const bookings = await prisma.booking.findMany({
    where: {
      ...(sp.status ? { status: sp.status as never } : {}),
      ...(sp.date ? { playDate: sp.date } : {}),
      ...(sp.q
        ? {
            OR: [
              // SQLite 的 LIKE 對 ASCII 本來就不分大小寫，故不需（也不支援）mode: 'insensitive'。
              { code: { contains: sp.q } },
              { contactName: { contains: sp.q } },
              { contactPhone: { contains: sp.q } },
            ],
          }
        : {}),
    },
    include: { items: { orderBy: { startsAt: 'asc' } }, venue: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const rows: AdminBookingRow[] = bookings.map((b) => {
    const base = taipeiToUtc(b.playDate, 0).getTime()
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      playDate: b.playDate,
      venueName: b.venue.name,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      total: b.total,
      note: b.note,
      createdAt: b.createdAt.toISOString(),
      slots: b.items.map(
        (it) =>
          `${it.courtName} ${formatRange(
            Math.round((it.startsAt.getTime() - base) / 60_000),
            Math.round((it.endsAt.getTime() - base) / 60_000),
          )}`,
      ),
    }
  })

  return <AdminBookingsClient rows={rows} query={sp.q ?? ''} status={sp.status ?? ''} date={sp.date ?? ''} />
}
