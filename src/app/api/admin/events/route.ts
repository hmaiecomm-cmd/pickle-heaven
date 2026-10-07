import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 活動清單（Phase 2）：直接使用球敘（Session）。
 * scope：upcoming（預設，尚未結束）、past（已結束）、all。已軟刪除的場次不列出。
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi('activities'))) return unauthorized()
  const scope = req.nextUrl.searchParams.get('scope') ?? 'upcoming'
  const now = new Date()

  const rows = await prisma.session.findMany({
    where: {
      deletedAt: null,
      ...(scope === 'past' ? { endAt: { lt: now } } : scope === 'all' ? {} : { endAt: { gte: now } }),
    },
    orderBy: { startAt: scope === 'past' ? 'desc' : 'asc' },
    take: 200,
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      template: { select: { title: true } },
      registrations: { where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } }, select: { status: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: rows.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? '',
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      bookingOpenAt: s.bookingOpenAt.toISOString(),
      bookingCloseAt: s.bookingCloseAt.toISOString(),
      capacity: s.capacity,
      reservedCapacity: s.reservedCapacity,
      confirmed: s.registrations.filter((r) => r.status === 'CONFIRMED').length,
      waitlisted: s.registrations.filter((r) => r.status === 'WAITLISTED').length,
      waitlistEnabled: s.waitlistEnabled,
      price: s.price,
      status: s.status,
      venueName: s.venue.name,
      courtName: s.court?.name ?? null,
      templateTitle: s.template?.title ?? null,
      skillLevelMin: s.skillLevelMin,
      skillLevelMax: s.skillLevelMax,
    })),
    meta: { total: rows.length },
  })
}
