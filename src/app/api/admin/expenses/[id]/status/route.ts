import { NextResponse, type NextRequest } from 'next/server'
import { apiError, readJson, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { ExpenseError, serializeExpenseRow, setExpenseStatus, type ExpenseStatus } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 狀態轉換。申請人：草稿→送審、退回→草稿／送審；擁有者：送審→核准／退回（退回需 note）。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  const body = await readJson<{ status?: string; note?: string }>(req)
  const next = body?.status
  if (!next || !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(next)) return apiError(400, 'BAD_REQUEST', '狀態不正確')
  try {
    const row = await setExpenseStatus(id, next as ExpenseStatus, ctx, body?.note ?? null)
    return NextResponse.json({ success: true, data: serializeExpenseRow(row) })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'EXPENSE', err.message)
    console.error('[expenses] status', err)
    return apiError(500, 'ERROR', '系統忙碌中，請稍後再試')
  }
}
