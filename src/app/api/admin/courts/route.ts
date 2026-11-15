import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { parseCourtInput } from '@/lib/court-input'

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
      indoor: c.indoor,
      covered: c.covered,
      surface: c.surface,
      sortOrder: c.sortOrder,
      pricePerHour: minPrice.get(c.venueId) ?? 0,
      status: c.status,
      lights: statusOf(c, 'LIGHTS'),
      fans: statusOf(c, 'FANS'),
      door: statusOf(c, 'DOOR'),
    })),
    meta: { total: courts.length },
  })
}

/** 新增球場（加在目前營運中的場館），寫入稽核紀錄；前台立即可預約。 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi('courts.manage')
  if (!admin) return unauthorized()
  const body = await readJson<Record<string, unknown>>(req)
  if (!body) return badRequest('缺少內容')
  const parsed = parseCourtInput(body, false)
  if ('error' in parsed) return badRequest(parsed.error)

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
  if (!venue) return notFound('尚未建立場館')
  const input = parsed.data
  if (await prisma.court.findFirst({ where: { venueId: venue.id, name: input.name }, select: { id: true } })) return badRequest('已有同名的球場')
  const sortOrder = input.sortOrder ?? ((await prisma.court.aggregate({ where: { venueId: venue.id }, _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1

  const court = await prisma.court.create({
    data: { venueId: venue.id, name: input.name!, capacity: input.capacity!, indoor: input.indoor ?? true, covered: input.covered ?? false, surface: input.surface ?? null, sortOrder },
  })
  await audit(admin, 'COURT_CREATE', court.id, { name: court.name })
  revalidatePath('/booking')
  revalidatePath('/admin/schedule')
  return NextResponse.json({ success: true, data: { id: court.id } })
}
