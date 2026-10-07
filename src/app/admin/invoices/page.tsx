import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { InvoicesClient } from './invoices-client'

export const metadata: Metadata = { title: '發票管理' }

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  if ((await pagePermission('invoice')) === 'forbidden') return <Forbidden />
  return <InvoicesClient />
}
