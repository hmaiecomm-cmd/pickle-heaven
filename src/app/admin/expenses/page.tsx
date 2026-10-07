import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { ExpensesClient } from './expenses-client'

export const metadata: Metadata = { title: '支出' }

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <ExpensesClient />
}
