import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { listOrders, maskOrderListAmounts } from '@/server/admin-orders'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { TransactionsClient } from './transactions-client'

export const metadata: Metadata = { title: '訂場與活動訂單' }
export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pagePermission('bookings')
  if (ctx === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const unmasked = await listOrders({
    q: sp.q ?? '',
    dateType: sp.dateType ?? 'play',
    from: sp.from ?? '',
    to: sp.to ?? '',
    courtId: sp.courtId ?? '',
    type: sp.type ?? 'all',
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
  return (
    <div>
      <PageTitle title="交易管理" desc="付款、訂單、退款、發票狀態分開顯示；退款與取消預約是不同動作，確認畫面會列出連動效果。" />
      <TransactionsClient
        initial={initial}
        courts={courts}
        openOrderId={sp.order ?? null}
        openRefund={sp.refund === '1'}
        perms={{ refund: can(ctx.role, 'refund'), invoice: can(ctx.role, 'invoice') }}
      />
    </div>
  )
}
