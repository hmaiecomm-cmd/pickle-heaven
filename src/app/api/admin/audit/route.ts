import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 稽核紀錄，新到舊。查詢參數 limit（預設 30，上限 200）、before（ISO 時間，分頁用）。 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi())) return unauthorized()
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 30))
  const beforeRaw = req.nextUrl.searchParams.get('before')
  const before = beforeRaw ? new Date(beforeRaw) : null

  const rows = await prisma.auditLog.findMany({
    where: before && !isNaN(before.getTime()) ? { createdAt: { lt: before } } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      target: r.target ?? undefined,
      detail: (r.detail as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: { total: rows.length },
  })
}
