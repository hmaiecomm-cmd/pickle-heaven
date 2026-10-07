import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { PaymentsClient } from './payments-client'

export const metadata: Metadata = { title: '付款紀錄' }

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <PaymentsClient />
}
