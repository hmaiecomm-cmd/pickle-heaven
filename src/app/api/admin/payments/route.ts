import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 資料庫的 SUCCESS 對應前端的 PAID，其餘相同。 */
const STATUS_MAP = { PENDING: 'PENDING', SUCCESS: 'PAID', FAILED: 'FAILED', REFUNDED: 'REFUNDED' } as const

/** 付款紀錄（Phase 2）。最近 500 筆，附訂單編號與聯絡人供列表顯示。 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi('finance'))) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入，或目前帳號沒有這項權限' } }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status')
  const dbStatus = status === 'PAID' ? 'SUCCESS' : status
  const where = dbStatus && dbStatus in STATUS_MAP ? { status: dbStatus as keyof typeof STATUS_MAP } : {}

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { booking: { select: { code: true, contactName: true, contactPhone: true } } },
  })

  const rows = payments.map((p) => ({
    id: p.id,
    reservationId: p.booking.code,
    bookingCode: p.booking.code,
    customerName: p.booking.contactName,
    customerPhone: p.booking.contactPhone,
    amount: p.amount,
    status: STATUS_MAP[p.status],
    method: p.method,
    provider: p.provider,
    transactionId: p.providerRef ?? undefined,
    failReason: p.failReason ?? undefined,
    paidAt: p.paidAt?.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data: rows, meta: { total: rows.length } })
}
