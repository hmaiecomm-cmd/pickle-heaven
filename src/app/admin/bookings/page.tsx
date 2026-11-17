import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { listOrders, maskOrderListAmounts } from '@/server/admin-orders'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { TransactionsClient } from './transactions-client'

export const metadata: Metadata = { title: '訂單記錄' }
export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pagePermission('bookings')
  if (ctx === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const tab = sp.tab === 'activity' || sp.tab === 'products' || sp.tab === 'points' ? sp.tab : 'venue'
  const orderType = tab === 'activity' ? 'activity' : tab === 'venue' ? 'court' : 'all'
  const unmasked = await listOrders({
    q: sp.q ?? '',
    dateType: sp.dateType ?? 'play',
    from: sp.from ?? '',
    to: sp.to ?? '',
    courtId: sp.courtId ?? '',
    type: sp.type ?? orderType,
    payment: sp.payment ?? '',
    order: sp.order_status ?? '',
    refund: sp.refund_status ?? '',
    invoice: sp.invoice ?? '',
    sort: sp.sort ?? 'created_desc',
    page: sp.page ?? 1,
  }).catch(() => listOrders({}))
  // 沒有財務權限：金額在伺服器端清除，不送到前端
  const initial = can(ctx.role, 'finance') ? unmasked : maskOrderListAmounts(unmasked)
  const courts = await prisma.court.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })

  // 查詢點數和票券數據
  const pointsLedger = await prisma.pointsLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: true },
  })

  const vouchers = await prisma.voucher.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: true },
  })

  return (
    <div>
      <PageTitle title="訂單記錄" desc="管理場地預約、活動報名、商品訂單和點數票券交易。" />
      <TransactionsClient
        initial={initial}
        courts={courts}
        pointsLedger={pointsLedger}
        vouchers={vouchers}
        openOrderId={sp.order ?? null}
        openRefund={sp.refund === '1'}
        openTab={tab}
        perms={{ refund: can(ctx.role, 'refund'), invoice: can(ctx.role, 'invoice') }}
      />
    </div>
  )
}
