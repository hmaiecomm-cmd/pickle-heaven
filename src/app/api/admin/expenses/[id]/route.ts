import { NextResponse, type NextRequest } from 'next/server'
import { apiError, readJson, toDateOrNull, toInt, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { ExpenseError, getExpense, serializeExpenseRow, updateExpense, type ExpenseCategory } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  try {
    return NextResponse.json({ success: true, data: serializeExpenseRow(await getExpense(id, ctx)) })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'EXPENSE', err.message)
    throw err
  }
}

/** 修改欄位與附件；每次修改留存更正歷史。body 同 POST，另有 note（更正說明）。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  const body = await readJson<{ category?: string; amount?: unknown; currency?: string; description?: string; vendorName?: string | null; expenseDate?: string | null; docNumber?: string | null; attachmentIds?: unknown; note?: string }>(req)
  if (!body) return apiError(400, 'BAD_REQUEST', '缺少內容')
  try {
    const row = await updateExpense(
      id,
      {
        ...(body.category !== undefined ? { category: body.category as ExpenseCategory } : {}),
        ...(body.amount !== undefined ? { amount: toInt(body.amount) ?? 0 } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.vendorName !== undefined ? { vendorName: body.vendorName } : {}),
        ...(body.expenseDate !== undefined ? { expenseDate: toDateOrNull(body.expenseDate ?? undefined) } : {}),
        ...(body.docNumber !== undefined ? { docNumber: body.docNumber } : {}),
        ...(Array.isArray(body.attachmentIds) ? { attachmentIds: body.attachmentIds.filter((x): x is string => typeof x === 'string') } : {}),
        note: body.note ?? null,
      },
      ctx,
    )
    return NextResponse.json({ success: true, data: serializeExpenseRow(row) })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'EXPENSE', err.message)
    console.error('[expenses] update', err)
    return apiError(500, 'ERROR', '系統忙碌中，請稍後再試')
  }
}
