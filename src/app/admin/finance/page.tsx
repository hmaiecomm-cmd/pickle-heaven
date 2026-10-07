import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { FinanceClient } from './finance-client'

export const metadata: Metadata = { title: '收入與退款' }

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <FinanceClient />
}
