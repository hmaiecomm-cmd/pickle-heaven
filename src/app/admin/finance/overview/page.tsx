import { pagePermission } from '@/lib/admin-auth'
import { PageTitle } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { FinanceOverviewClient } from './overview-client'

export const metadata: Metadata = { title: '財務報表 - 管理總覽' }
export const dynamic = 'force-dynamic'

export default async function FinanceOverviewPage() {
  await pagePermission('finance')

  return (
    <div className="space-y-6">
      <PageTitle
        title="管理總覽"
        desc="財務報表預覽版本，展示後台報表樣式與內容"
      />
      <FinanceOverviewClient />
    </div>
  )
}
