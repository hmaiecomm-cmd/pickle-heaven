import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { FinanceTabNav } from './tab-nav'
import { BookingsTab } from './tabs/bookings-tab'
import { PaymentsTab } from './tabs/payments-tab'
import { RefundsTab } from './tabs/refunds-tab'
import { TopupTab } from './tabs/topup-tab'
import { PointsTab } from './tabs/points-tab'
import { InvoicesTab } from './tabs/invoices-tab'
import { ExpensesTab } from './tabs/expenses-tab'
import { DailyTab } from './tabs/daily-tab'
import { ProductsTab } from './tabs/products-tab'

export const metadata: Metadata = { title: '訂單與財務' }
export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'bookings', label: '訂場與活動訂單', permission: 'bookings' },
  { id: 'payments', label: '收款紀錄', permission: 'finance' },
  { id: 'refunds', label: '退款紀錄', permission: 'finance' },
  { id: 'topup', label: '儲值交易', permission: 'finance' },
  { id: 'points', label: '點數與票券交易', permission: 'members' },
  { id: 'invoices', label: '發票管理', permission: 'invoice' },
  { id: 'expenses', label: '費用與收據審核', permission: 'expenses.own' },
  { id: 'daily', label: '日結與對帳', permission: 'finance' },
  { id: 'products', label: '商品訂單', permission: 'marketing', notOpen: true },
]

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pagePermission('finance')
  const sp = await searchParams
  const tab = sp.tab ?? 'bookings'
  const activeTab = TABS.some(t => t.id === tab) ? tab : 'bookings'

  return (
    <div className="space-y-4">
      <PageTitle title="訂單與財務" desc="所有訂單、付款、退款、發票、儲值與費用管理集中在此。" />
      <FinanceTabNav activeTab={activeTab} tabs={TABS} />
      <div>
        {activeTab === 'bookings' && <BookingsTab searchParams={sp} />}
        {activeTab === 'payments' && <PaymentsTab searchParams={sp} />}
        {activeTab === 'refunds' && <RefundsTab searchParams={sp} />}
        {activeTab === 'topup' && <TopupTab searchParams={sp} />}
        {activeTab === 'points' && <PointsTab searchParams={sp} />}
        {activeTab === 'invoices' && <InvoicesTab searchParams={sp} />}
        {activeTab === 'expenses' && <ExpensesTab searchParams={sp} />}
        {activeTab === 'daily' && <DailyTab searchParams={sp} />}
        {activeTab === 'products' && <ProductsTab searchParams={sp} />}
      </div>
    </div>
  )
}
