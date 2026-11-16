import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { ExpensesClient } from '../../expenses/expenses-client'

export async function ExpensesTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('expenses.own')) === 'forbidden') return <Forbidden />
  return <ExpensesClient />
}
