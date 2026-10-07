import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { parseCoachInput, serializeCoach, type CoachInput } from '@/lib/coach-input'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AVAIL_ORDER = { orderBy: [{ dayOfWeek: 'asc' as const }, { startMinute: 'asc' as const }] }

export async function GET() {
  if (!(await requireAdminApi())) return unauthorized()
  const rows = await prisma.coach.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }], include: { availability: AVAIL_ORDER } })
  return NextResponse.json({ success: true, data: rows.map(serializeCoach), meta: { total: rows.length } })
}

/** 新增教練。body: { name, phone?, email?, status?, specialties[], hourlyRate, bio?, availability[{ dayOfWeek, startMinute, endMinute }] } */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const body = await readJson<CoachInput>(req)
  if (!body) return badRequest('缺少內容')
  const parsed = parseCoachInput(body, false)
  if ('error' in parsed) return badRequest(parsed.error)

  const coach = await prisma.coach.create({
    data: {
      name: parsed.data.name!,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      status: parsed.data.status ?? 'ACTIVE',
      specialties: parsed.data.specialties ?? [],
      hourlyRate: parsed.data.hourlyRate ?? 0,
      bio: parsed.data.bio ?? null,
      availability: { create: parsed.availability ?? [] },
    },
    include: { availability: AVAIL_ORDER },
  })
  await audit(admin, 'COACH_CREATE', coach.id, { name: coach.name, hourlyRate: coach.hourlyRate })
  return NextResponse.json({ success: true, data: serializeCoach(coach) }, { status: 201 })
}
