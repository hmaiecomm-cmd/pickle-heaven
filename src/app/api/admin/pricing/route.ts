import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 定價資料（Phase 2）：場地費率規則（即前台計價用的 PriceRule）與會員折扣。 */
export async function GET() {
  if (!(await requireAdminApi())) return unauthorized()
  const [rules, tiers] = await Promise.all([
    prisma.priceRule.findMany({
      orderBy: [{ venueId: 'asc' }, { dayType: 'asc' }, { startMinute: 'asc' }],
      include: { venue: { select: { name: true } } },
    }),
    prisma.membershipTier.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])
  return NextResponse.json({
    success: true,
    data: {
      priceRules: rules.map((r) => ({
        id: r.id,
        venueId: r.venueId,
        venueName: r.venue.name,
        name: r.name,
        kind: r.kind,
        dayType: r.dayType,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        price: r.price,
        priority: r.priority,
      })),
      tiers: tiers.map((t) => ({ level: t.level, label: t.label, discountPct: t.discountPct })),
    },
  })
}
