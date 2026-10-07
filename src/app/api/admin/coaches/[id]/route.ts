import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { parseCoachInput, serializeCoach, type CoachInput } from '@/lib/coach-input'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LABEL: Record<string, string> = {
  name: '姓名', phone: '電話', email: 'Email', status: '狀態', specialties: '專長', hourlyRate: '時薪', bio: '簡介', availability: '可授課時段',
}

/** 修改教練（部分欄位）。提供 availability 時整組取代。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<CoachInput>(req)
  if (!body) return badRequest('缺少內容')
  const parsed = parseCoachInput(body, true)
  if ('error' in parsed) return badRequest(parsed.error)

  const before = await prisma.coach.findUnique({ where: { id }, select: { name: true, status: true, hourlyRate: true } })
  if (!before) return notFound('找不到教練')

  const coach = await prisma.$transaction(async (tx) => {
    if (parsed.availability) {
      await tx.coachAvailability.deleteMany({ where: { coachId: id } })
      if (parsed.availability.length) await tx.coachAvailability.createMany({ data: parsed.availability.map((a) => ({ ...a, coachId: id })) })
    }
    return tx.coach.update({
      where: { id },
      data: parsed.data,
      include: { availability: { orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] } },
    })
  })

  const fields = [...Object.keys(parsed.data), ...(parsed.availability ? ['availability'] : [])].map((k) => LABEL[k] ?? k)
  await audit(admin, 'COACH_UPDATE', id, {
    name: before.name,
    fields,
    ...(parsed.data.status && parsed.data.status !== before.status ? { from: before.status, to: parsed.data.status } : {}),
  })
  return NextResponse.json({ success: true, data: serializeCoach(coach) })
}
