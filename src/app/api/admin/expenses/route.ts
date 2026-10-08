import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, readJson, toDateOrNull, toInt, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { createExpense, EXPENSE_CATEGORIES, EXPENSE_INCLUDE, ExpenseError, serializeExpenseRow, visibleWhere, type ExpenseCategory } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 費用清單（含附件摘要）。擁有者看全部；管理員與工作人員只看本人的申請。 */
export async function GET(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const category = req.nextUrl.searchParams.get('category')
  const status = req.nextUrl.searchParams.get('status')
  const rows = await prisma.expense.findMany({
    where: {
      ...visibleWhere(ctx),
      ...(category && (EXPENSE_CATEGORIES as readonly string[]).includes(category) ? { category: category as ExpenseCategory } : {}),
      ...(status ? { status: status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}),
    },
    orderBy: { submittedAt: 'desc' },
    take: 500,
    include: EXPENSE_INCLUDE,
  })
  return NextResponse.json({ success: true, data: rows.map(serializeExpenseRow), meta: { total: rows.length, reviewAll: can(ctx.role, 'expenses.review'), me: `admin:${ctx.username}` } })
}

/**
 * 登錄費用（拍照／上傳／手動共用）。
 * body: { category, amount, currency?, description, vendorName?, expenseDate?, docNumber?, attachmentIds?, status?: 'DRAFT'|'SUBMITTED', idempotencyKey }
 * 同一 idempotencyKey 重複送出只會建立一筆。
 */
export async function POST(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const body = await readJson<{ category?: string; amount?: unknown; currency?: string; description?: string; vendorName?: string; expenseDate?: string; docNumber?: string; attachmentIds?: unknown; status?: string; idempotencyKey?: string }>(req)
  if (!body) return apiError(400, 'BAD_REQUEST', '缺少內容')
  try {
    const res = await createExpense(
      {
        category: body.category as ExpenseCategory,
        amount: toInt(body.amount) ?? 0,
        currency: body.currency,
        description: body.description ?? '',
        vendorName: body.vendorName ?? null,
        expenseDate: toDateOrNull(body.expenseDate),
        docNumber: body.docNumber ?? null,
        attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds.filter((x): x is string => typeof x === 'string') : [],
        status: body.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        idempotencyKey: typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8 ? body.idempotencyKey.slice(0, 80) : null,
      },
      ctx,
    )
    return NextResponse.json({ success: true, data: serializeExpenseRow(res.expense), meta: { duplicateSubmit: res.duplicateSubmit } }, { status: res.duplicateSubmit ? 200 : 201 })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'EXPENSE', err.message)
    console.error('[expenses] create', err)
    return apiError(500, 'ERROR', '系統忙碌中，請稍後再試')
  }
}
