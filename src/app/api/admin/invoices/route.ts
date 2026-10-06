import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'
import { serializeInvoice } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 發票清單。查詢參數 status。 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi())) return unauthorized()
  const status = req.nextUrl.searchParams.get('status')
  const rows = await prisma.invoice.findMany({
    where: status ? { status: status as 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED' } : {},
    orderBy: { issueDate: 'desc' },
    take: 500,
    include: { user: { select: { displayName: true } }, booking: { select: { code: true } } },
  })
  return NextResponse.json({ success: true, data: rows.map(serializeInvoice), meta: { total: rows.length } })
}
