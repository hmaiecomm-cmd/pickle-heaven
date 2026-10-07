import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { serializeExpense } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 允許的狀態轉換 */
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  REJECTED: ['DRAFT'],
  APPROVED: [],
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi('expenses.review')
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<{ status?: string }>(req)
  const next = body?.status
  if (!next) return badRequest('缺少狀態')

  const current = await prisma.expense.findUnique({ where: { id }, select: { status: true, expenseNumber: true } })
  if (!current) return notFound('找不到費用')
  if (!TRANSITIONS[current.status]?.includes(next)) return badRequest(`無法從「${current.status}」變更為「${next}」`)

  const row = await prisma.expense.update({
    where: { id },
    data: {
      status: next as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
      approvedAt: next === 'APPROVED' ? new Date() : next === 'DRAFT' ? null : undefined,
      approvedBy: next === 'APPROVED' ? admin : next === 'DRAFT' ? null : undefined,
    },
    include: { receipt: true },
  })
  await audit(admin, 'EXPENSE_STATUS', id, { expenseNumber: current.expenseNumber, from: current.status, to: next })
  return NextResponse.json({ success: true, data: serializeExpense(row) })
}
