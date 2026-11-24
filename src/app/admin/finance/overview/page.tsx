import { pagePermission } from '@/lib/admin-auth'
import { PageTitle, Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { FinanceOverviewClient } from './overview-client'

export const metadata: Metadata = { title: '營運報表下載列印' }
export const dynamic = 'force-dynamic'

export default async function FinanceOverviewPage() {
  const ctx = await pagePermission('finance')
  if (ctx === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-6">
      <PageTitle
        title="營運報表下載列印"
        desc="選擇日期區間與報表類型，下載、列印或預覽運營報表"
      />
      <FinanceOverviewClient />
    </div>
  )
}
