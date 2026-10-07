import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { ReceiptsClient } from './receipts-client'

export const metadata: Metadata = { title: '收據' }

export const dynamic = 'force-dynamic'

export default async function ReceiptsPage() {
  const ctx = await pagePermission('expenses.own')
  if (ctx === 'forbidden') return <Forbidden />
  void can(ctx.role, 'expenses.review')
  return <ReceiptsClient />
}
