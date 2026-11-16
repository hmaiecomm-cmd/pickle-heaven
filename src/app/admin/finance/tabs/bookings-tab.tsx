import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { listOrders, maskOrderListAmounts } from '@/server/admin-orders'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { TransactionsClient } from '../../bookings/transactions-client'

export async function BookingsTab({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const ctx = await pagePermission('bookings')
  if (ctx === 'forbidden') return <Forbidden />

  const unmasked = await listOrders({
    q: searchParams.q ?? '',
    dateType: searchParams.dateType ?? 'play',
    from: searchParams.from ?? '',
    to: searchParams.to ?? '',
    courtId: searchParams.courtId ?? '',
    type: searchParams.type ?? 'all',
    payment: searchParams.payment ?? '',
    order: searchParams.order_status ?? '',
    refund: searchParams.refund_status ?? '',
    invoice: searchParams.invoice ?? '',
    sort: searchParams.sort ?? 'created_desc',
    page: searchParams.page ?? 1,
  }).catch(() => listOrders({}))

  const initial = can(ctx.role, 'finance') ? unmasked : maskOrderListAmounts(unmasked)
  const courts = await prisma.court.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })

  return (
    <div>
      <PageTitle title="交易管理" desc="付款、訂單、退款、發票狀態分開顯示；退款與取消預約是不同動作，確認畫面會列出連動效果。" />
      <TransactionsClient
        initial={initial}
        courts={courts}
        openOrderId={searchParams.order ?? null}
        openRefund={searchParams.refund === '1'}
        perms={{ refund: can(ctx.role, 'refund'), invoice: can(ctx.role, 'invoice') }}
      />
    </div>
  )
}
