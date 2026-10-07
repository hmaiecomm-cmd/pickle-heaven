import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 會員清單（Phase 2）。
 * 累計消費與最近到訪由已付款／已完成訂單彙整；最近 5 筆訂單供詳情顯示。
 */
export async function GET() {
  if (!(await requireAdminApi('members'))) return unauthorized()

  const [users, agg] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        bookings: {
          where: { status: { in: ['PAID', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { code: true, total: true, status: true, playDate: true, paidAt: true, createdAt: true, items: { select: { courtName: true }, take: 1 } },
        },
      },
    }),
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { total: true },
      _count: { _all: true },
      _max: { paidAt: true, createdAt: true },
    }),
  ])
  const stats = new Map(agg.map((a) => [a.userId, a]))

  return NextResponse.json({
    success: true,
    data: users.map((u) => {
      const s = stats.get(u.id)
      const lastVisit = s?._max.paidAt ?? s?._max.createdAt ?? u.createdAt
      return {
        id: u.id,
        name: u.displayName,
        email: u.email ?? '',
        phone: u.phone ?? '',
        membershipLevel: u.membershipLevel,
        joinDate: u.createdAt.toISOString(),
        lastVisit: lastVisit.toISOString(),
        totalSpent: s?._sum.total ?? 0,
        bookingCount: s?._count._all ?? 0,
        points: u.points,
        avatar: u.pictureUrl ?? undefined,
        recentBookings: u.bookings.map((b) => ({
          code: b.code,
          name: `${b.playDate} ${b.items[0]?.courtName ?? ''}`.trim(),
          amount: b.total,
          status: b.status,
          date: (b.paidAt ?? b.createdAt).toISOString(),
        })),
      }
    }),
    meta: { total: users.length },
  })
}
