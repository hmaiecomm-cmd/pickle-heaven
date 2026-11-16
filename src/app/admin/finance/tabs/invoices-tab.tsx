import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { InvoicesClient } from '../../invoices/invoices-client'

export async function InvoicesTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('invoice')) === 'forbidden') return <Forbidden />
  return <InvoicesClient />
}
