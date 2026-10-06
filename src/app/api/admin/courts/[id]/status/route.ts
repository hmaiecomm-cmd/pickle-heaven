import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const
type CourtStatus = (typeof STATUSES)[number]

/** 變更球場營運狀態；非 ACTIVE 時同步關閉 active，前台即不再開放預約。寫入稽核紀錄。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入' } }, { status: 401 })

  const { id } = await params
  const body = (await req.json().catch(() => null)) as { status?: string } | null
  const status = body?.status
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ success: false, error: { code: 'BAD_STATUS', message: '狀態不正確' } }, { status: 400 })
  }

  const before = await prisma.court.findUnique({ where: { id }, select: { id: true, name: true, status: true } })
  if (!before) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '找不到球場' } }, { status: 404 })

  const next = status as CourtStatus
  const court = await prisma.$transaction(async (tx) => {
    const updated = await tx.court.update({ where: { id }, data: { status: next, active: next === 'ACTIVE' } })
    await tx.auditLog.create({
      data: { actor: admin, action: 'COURT_STATUS', target: id, detail: { name: before.name, from: before.status, to: next } },
    })
    return updated
  })

  revalidatePath('/booking')
  revalidatePath('/admin/schedule')
  return NextResponse.json({ success: true, data: { id: court.id, status: court.status, active: court.active } })
}
