import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { incidentStats } from '@/server/finance-metrics'
import { overview, operationsDashboard, periodOf, todayPeriod, utilization } from './report-data'
import { OperationsDashboard } from './operations-dashboard'

export const metadata: Metadata = { title: '營運總覽' }
export const dynamic = 'force-dynamic'

export default async function ReportsOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string; court?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const p = periodOf(sp.days)
  const t = todayPeriod()
  const [today, todayUtil, incidents, data] = await Promise.all([overview(t), utilization(t), incidentStats(t), operationsDashboard(p, sp.court)])
  const todayRate = todayUtil && todayUtil.courts.length ? Math.round(todayUtil.courts.reduce((s, c) => s + c.rate, 0) / todayUtil.courts.length) : null
  const by = new Map(incidents.byType.map((x) => [x.type, x.count]))

  return (
    <div className="space-y-6">
      <PageTitle title="營運總覽" desc="即時場館狀態" />
      <OperationsDashboard data={data} days={p.days} courtId={sp.court} kpi={{ bookings: today.totals.orders, activeCourts: todayUtil?.courts.filter((c) => c.booked + c.event > 0).length ?? 0, rate: todayRate, revenue: today.totals.collected, incidents: incidents.open }} incidents={{ payment: (by.get('PAYMENT_FAILED') ?? 0) + (by.get('PAYMENT_AFTER_EXPIRY') ?? 0), notification: by.get('NOTIFICATION_FAILED') ?? 0, device: (by.get('DEVICE_OFFLINE') ?? 0) + (by.get('DEVICE_STALE') ?? 0), cancelled: today.cancelled }} />
      <SourceNote source="預約、付款、儲值與異常事件紀錄" basis="使用率依 Reservation；營收依付款成功時間；時間以 Asia/Taipei" updatedAt={new Date()} />
    </div>
  )
}
