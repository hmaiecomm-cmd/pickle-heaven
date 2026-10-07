import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { serializeInvoice } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['PAID', 'CANCELLED'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi('invoice')
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<{ status?: string }>(req)
  const next = body?.status
  if (!next) return badRequest('缺少狀態')

  const current = await prisma.invoice.findUnique({ where: { id }, select: { status: true, dueDate: true, invoiceNumber: true } })
  if (!current) return notFound('找不到發票')
  // 已開立且過期者，依逾期規則處理
  const effective = current.status === 'ISSUED' && current.dueDate < new Date() ? 'OVERDUE' : current.status
  if (!TRANSITIONS[effective]?.includes(next)) return badRequest(`無法從「${effective}」變更為「${next}」`)

  const row = await prisma.invoice.update({
    where: { id },
    data: { status: next as 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED' },
    include: { user: { select: { displayName: true } }, booking: { select: { code: true } } },
  })
  await audit(admin, 'INVOICE_STATUS', id, { invoiceNumber: current.invoiceNumber, from: effective, to: next })
  return NextResponse.json({ success: true, data: serializeInvoice(row) })
}
