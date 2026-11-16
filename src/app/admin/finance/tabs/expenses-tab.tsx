import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden } from '@/components/admin/page-bits'
import { ExpensesClient } from '../../expenses/expenses-client'

export async function ExpensesTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const ctx = await pagePermission('expenses.own')
  if (ctx === 'forbidden') return <Forbidden />
  const review = can(ctx.role, 'expenses.review')
  return <ExpensesClient review={review} me={ctx.accountId} displayName={ctx.displayName} />
}
