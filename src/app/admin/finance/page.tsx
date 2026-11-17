import { pagePermission } from '@/lib/admin-auth'
import { PageTitle } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { FinanceTabNav } from './tab-nav'
import { BookingsTab } from './tabs/bookings-tab'
import { PointsTab } from './tabs/points-tab'
import { ProductsTab } from './tabs/products-tab'

export const metadata: Metadata = { title: '訂單記錄' }
export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'all', label: '全部記錄', permission: 'bookings' },
  { id: 'bookings', label: '場地與活動', permission: 'bookings' },
  { id: 'products', label: '商品訂單', permission: 'marketing', notOpen: true },
  { id: 'points', label: '點數與票券', permission: 'members' },
]

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pagePermission('finance')
  const sp = await searchParams
  const tab = sp.tab ?? 'all'
  const activeTab = TABS.some(t => t.id === tab) ? tab : 'all'

  return (
    <div className="space-y-4">
      <PageTitle title="訂單記錄" desc="查看顧客的場地、活動、商品與點數交易記錄；付款、退款與發票狀態在單筆明細中查看。" />
      <FinanceTabNav activeTab={activeTab} tabs={TABS} />
      <div>
        {(activeTab === 'all' || activeTab === 'bookings') && <BookingsTab searchParams={sp} />}
        {activeTab === 'products' && <ProductsTab searchParams={sp} />}
        {activeTab === 'points' && <PointsTab searchParams={sp} />}
      </div>
    </div>
  )
}
