import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, nextNumber, readJson, requireAdminApi, toDateOrNull, toInt, unauthorized } from '@/lib/admin-api'
import { serializeExpense } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATEGORIES = ['MAINTENANCE', 'SUPPLIES', 'UTILITIES', 'LABOR', 'OTHER'] as const
type Category = (typeof CATEGORIES)[number]

/** 費用清單。查詢參數 category、status。 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi())) return unauthorized()
  const category = req.nextUrl.searchParams.get('category')
  const status = req.nextUrl.searchParams.get('status')
  const rows = await prisma.expense.findMany({
    where: {
      ...(category && (CATEGORIES as readonly string[]).includes(category) ? { category: category as Category } : {}),
      ...(status ? { status: status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}),
    },
    orderBy: { submittedAt: 'desc' },
    take: 500,
    include: { receipt: true },
  })
  return NextResponse.json({ success: true, data: rows.map(serializeExpense), meta: { total: rows.length } })
}

/** 手動登錄費用。body: { category, amount, description, submittedAt?, status?: 'DRAFT' | 'SUBMITTED', receiptId? } */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const body = await readJson<{ category?: string; amount?: unknown; description?: string; submittedAt?: string; status?: string; receiptId?: string }>(req)
  if (!body) return badRequest('缺少內容')
  const amount = toInt(body.amount)
  const description = body.description?.trim() ?? ''
  if (!body.category || !(CATEGORIES as readonly string[]).includes(body.category)) return badRequest('類別不正確')
  if (amount === null || amount <= 0) return badRequest('金額必須大於 0')
  if (!description) return badRequest('請填寫說明')
  const status = body.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT'
  const submittedAt = toDateOrNull(body.submittedAt) ?? new Date()

  const create = async () =>
    prisma.expense.create({
      data: {
        expenseNumber: await nextNumber('EXP', () => prisma.expense.count({ where: { expenseNumber: { startsWith: `EXP-${new Date().getFullYear()}-` } } })),
        category: body.category as Category,
        amount,
        status,
        description,
        submittedAt,
        receiptId: body.receiptId || undefined,
      },
      include: { receipt: true },
    })
  let row
  try {
    row = await create()
  } catch {
    row = await create() // 流水號撞號時重試一次
  }
  await audit(admin, 'EXPENSE_CREATE', row.id, { expenseNumber: row.expenseNumber, amount, status })
  return NextResponse.json({ success: true, data: serializeExpense(row) }, { status: 201 })
}
