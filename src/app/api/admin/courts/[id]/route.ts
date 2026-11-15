import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { parseCourtInput } from '@/lib/court-input'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 修改球場基本資料（部分欄位）。營運狀態請用 /status。寫入稽核紀錄。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi('courts.manage')
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<Record<string, unknown>>(req)
  if (!body) return badRequest('缺少內容')
  const parsed = parseCourtInput(body, true)
  if ('error' in parsed) return badRequest(parsed.error)

  const before = await prisma.court.findUnique({ where: { id } })
  if (!before) return notFound('找不到球場')
  const data = parsed.data
  if (data.name && data.name !== before.name) {
    const dup = await prisma.court.findFirst({ where: { venueId: before.venueId, name: data.name, id: { not: id } }, select: { id: true } })
    if (dup) return badRequest('已有同名的球場')
  }

  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => before[k] !== data[k])
  if (changed.length === 0) return NextResponse.json({ success: true, data: { id, changed: [] } })

  await prisma.court.update({ where: { id }, data })
  await audit(admin, 'COURT_UPDATE', id, {
    name: before.name,
    from: Object.fromEntries(changed.map((k) => [k, before[k]])),
    to: Object.fromEntries(changed.map((k) => [k, data[k]])),
  })
  revalidatePath('/booking')
  revalidatePath('/admin/schedule')
  return NextResponse.json({ success: true, data: { id, changed } })
}
