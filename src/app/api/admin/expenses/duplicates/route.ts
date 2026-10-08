import { NextResponse, type NextRequest } from 'next/server'
import { toDateOrNull, toInt, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { findDuplicateHints } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 重複收據提醒（只提醒，不阻擋）。query: amount, vendorName, expenseDate, docNumber, excludeId */
export async function GET(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const q = req.nextUrl.searchParams
  const hints = await findDuplicateHints(
    { amount: toInt(q.get('amount')) ?? 0, vendorName: q.get('vendorName'), expenseDate: toDateOrNull(q.get('expenseDate') ?? undefined), docNumber: q.get('docNumber'), excludeId: q.get('excludeId') },
    ctx,
  )
  return NextResponse.json({ success: true, data: hints })
}
