import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { ReceiptsClient } from './receipts-client'

export const metadata: Metadata = { title: '收據' }

export const dynamic = 'force-dynamic'

export default async function ReceiptsPage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <ReceiptsClient />
}
