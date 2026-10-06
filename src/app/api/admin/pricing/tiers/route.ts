import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, readJson, requireAdminApi, toInt, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LEVELS = ['BASIC', 'PREMIUM', 'VIP'] as const
const LABEL: Record<(typeof LEVELS)[number], string> = { BASIC: '一般', PREMIUM: '進階', VIP: 'VIP' }

/** 更新會員折扣。body: { tiers: [{ level, discountPct }] }，折扣 0–100。 */
export async function PUT(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const body = await readJson<{ tiers?: { level?: string; discountPct?: unknown }[] }>(req)
  if (!body?.tiers?.length) return badRequest('缺少內容')

  const updates: { level: (typeof LEVELS)[number]; discountPct: number }[] = []
  for (const t of body.tiers) {
    const pct = toInt(t.discountPct)
    if (!t.level || !(LEVELS as readonly string[]).includes(t.level)) return badRequest('等級不正確')
    if (pct === null || pct < 0 || pct > 100) return badRequest('折扣需介於 0 到 100')
    updates.push({ level: t.level as (typeof LEVELS)[number], discountPct: pct })
  }

  const before = await prisma.membershipTier.findMany()
  const rows = await prisma.$transaction(
    updates.map((u, i) =>
      prisma.membershipTier.upsert({
        where: { level: u.level },
        create: { level: u.level, label: LABEL[u.level], discountPct: u.discountPct, sortOrder: i },
        update: { discountPct: u.discountPct },
      }),
    ),
  )
  await audit(admin, 'PRICING_TIERS', 'membership', {
    from: Object.fromEntries(before.map((b) => [b.level, b.discountPct])),
    to: Object.fromEntries(updates.map((u) => [u.level, u.discountPct])),
  })
  return NextResponse.json({ success: true, data: rows.map((t) => ({ level: t.level, label: t.label, discountPct: t.discountPct })) })
}
