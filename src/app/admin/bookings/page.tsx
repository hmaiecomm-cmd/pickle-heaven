import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { listOrders, maskOrderListAmounts } from '@/server/admin-orders'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { activityOrderStats, listActivityOrders, parseActivityFilters } from '@/server/activity-orders-admin'
import { TransactionsClient } from './transactions-client'
import { ActivityOrdersContainer } from './activity-orders-container'
import { SessionDetailPanel } from './session-detail-panel'

export const metadata: Metadata = { title: '訂單紀錄' }
export const dynamic = 'force-dynamic'

const TAB_CONFIG = [
  { label: '場地訂單', value: 'venue' },
  { label: '活動訂單', value: 'activity' },
  { label: '商品訂單', value: 'products' },
  { label: '點數與票券', value: 'points' },
] as const

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pagePermission('bookings')
  if (ctx === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const tab = sp.tab === 'activity' || sp.tab === 'products' || sp.tab === 'points' ? sp.tab : 'venue'

  if (tab === 'activity') {
    const filters = parseActivityFilters(sp)
    const [stats, list] = await Promise.all([activityOrderStats(can(ctx.role, 'finance')), listActivityOrders(filters)])
    const selectedSessionId = sp.session

    return (
      <div>
        <PageTitle title="訂單紀錄" desc="管理所有訂單類型" />
        {/* 水平分頁導航 */}
        <div className="mb-6 flex gap-1 border-b border-zinc-200">
          {TAB_CONFIG.map((t) => (
            <Link
              key={t.value}
              href={`/admin/bookings?tab=${t.value}`}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.value
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <ActivityOrdersContainer
          stats={stats}
          rows={list.rows}
          total={list.total}
          pages={list.pages}
          filters={filters}
          range={{ from: list.from, to: list.to }}
          canDetail={can(ctx.role, 'activities.view')}
          sessionDetail={
            selectedSessionId ? (
              <Suspense fallback={<div className="py-8 text-center text-sm text-muted">載入中...</div>}>
                <SessionDetailPanel sessionId={selectedSessionId} />
              </Suspense>
            ) : undefined
          }
        />
      </div>
    )
  }

  const orderType = tab === 'venue' ? 'court' : 'all'
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

  // 根據 tab 設定標題和描述
  const titleConfig = {
    venue: { title: '場地訂單', desc: '查看與管理顧客的場地預約訂單。' },
    activity: { title: '活動訂單', desc: '查看與管理顧客的活動報名訂單。' },
    products: { title: '商品訂單', desc: '查看與管理顧客的商品訂單。' },
    points: { title: '點數與票券', desc: '查看顧客的點數交易與票券記錄。' },
  } as const

  return (
    <div>
      <PageTitle title="訂單紀錄" desc="管理所有訂單類型" />
      {/* 水平分頁導航 */}
      <div className="mb-6 flex gap-1 border-b border-zinc-200">
        {TAB_CONFIG.map((t) => (
          <Link
            key={t.value}
            href={`/admin/bookings?tab=${t.value}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.value
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <TransactionsClient
        key={tab}
        initial={initial}
        courts={courts}
        pointsLedger={pointsLedger}
        vouchers={vouchers}
        openOrderId={sp.order ?? null}
        openRefund={sp.refund === '1'}
        openTab={tab}
        perms={{ refund: can(ctx.role, 'refund'), invoice: can(ctx.role, 'invoice'), access: can(ctx.role, 'access'), accessGrant: can(ctx.role, 'access.grant') }}
      />
    </div>
  )
}
