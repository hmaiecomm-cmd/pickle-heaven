import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 球場清單（Phase 2）。
 * 回傳形狀對齊前端 Court 模型：時租取該場館最低的 PriceRule 價格，
 * 照明／風扇／門禁狀態取自對應類型的 Device（沒有裝置則為 undefined）。
 */
export async function GET() {
  if (!(await requireAdminApi('courts'))) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入，或目前帳號沒有這項權限' } }, { status: 403 })

  const courts = await prisma.court.findMany({
    orderBy: [{ venueId: 'asc' }, { sortOrder: 'asc' }],
    include: { devices: { select: { type: true, status: true } } },
  })
  const venueIds = [...new Set(courts.map((c) => c.venueId))]
  const rules = await prisma.priceRule.groupBy({ by: ['venueId'], where: { venueId: { in: venueIds } }, _min: { price: true } })
  const minPrice = new Map(rules.map((r) => [r.venueId, r._min.price ?? 0]))

  const statusOf = (c: (typeof courts)[number], type: 'LIGHTS' | 'FANS' | 'DOOR') => c.devices.find((d) => d.type === type)?.status

  return NextResponse.json({
    success: true,
    data: courts.map((c) => ({
      id: c.id,
      name: c.name,
      venueId: c.venueId,
      capacity: c.capacity,
      pricePerHour: minPrice.get(c.venueId) ?? 0,
      status: c.status,
      lights: statusOf(c, 'LIGHTS'),
      fans: statusOf(c, 'FANS'),
      door: statusOf(c, 'DOOR'),
    })),
    meta: { total: courts.length },
  })
}
