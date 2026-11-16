import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { PaymentsClient } from '../../finance/payments/payments-client'

export async function PaymentsTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <PaymentsClient />
}
