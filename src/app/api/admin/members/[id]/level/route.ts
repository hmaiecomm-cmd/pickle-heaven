import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LEVELS = ['BASIC', 'PREMIUM', 'VIP'] as const

/** 調整會員等級，寫入稽核紀錄。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi('members')
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<{ level?: string }>(req)
  const level = body?.level
  if (!level || !(LEVELS as readonly string[]).includes(level)) return badRequest('等級不正確')

  const before = await prisma.user.findUnique({ where: { id }, select: { displayName: true, membershipLevel: true } })
  if (!before) return notFound('找不到會員')
  const user = await prisma.user.update({ where: { id }, data: { membershipLevel: level as (typeof LEVELS)[number] } })
  await audit(admin, 'MEMBER_LEVEL', id, { name: before.displayName, from: before.membershipLevel, to: level })
  return NextResponse.json({ success: true, data: { id: user.id, membershipLevel: user.membershipLevel } })
}
