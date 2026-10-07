import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { ExpensesClient } from './expenses-client'

export const metadata: Metadata = { title: '支出' }

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const ctx = await pagePermission('expenses.own')
  if (ctx === 'forbidden') return <Forbidden />
  return <ExpensesClient review={can(ctx.role, 'expenses.review')} />
}
