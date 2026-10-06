import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 裝置清單（Phase 2）。形狀對齊前端 Device 模型。 */
export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入' } }, { status: 401 })

  const devices = await prisma.device.findMany({ orderBy: [{ courtId: 'asc' }, { type: 'asc' }, { name: 'asc' }] })
  return NextResponse.json({
    success: true,
    data: devices.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      courtId: d.courtId,
      status: d.status,
      lastSeen: d.lastSeen.toISOString(),
      lastAction: d.lastAction ?? undefined,
    })),
    meta: { total: devices.length },
  })
}
