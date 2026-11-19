import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { incidentStats } from '@/server/finance-metrics'
import { taipeiDateString } from '@/lib/time'
import { overview, todayPeriod, utilization } from './report-data'
import { overviewData, parseOverviewRange } from './overview-data'
import { OperationsDashboard } from './operations-dashboard'
import type { ChartKey } from './overview-types'

export const metadata: Metadata = { title: '營運總覽' }
export const dynamic = 'force-dynamic'

const CHARTS: ChartKey[] = ['usage', 'courts', 'heatmap', 'revenue']

export default async function ReportsOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; court?: string; chart?: string; days?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const sp = await searchParams
  // 舊網址 ?days=12/30/90 仍可開啟：對應到最接近的新期間
  const legacy = !sp.range && sp.days ? (Number(sp.days) >= 90 ? '90' : Number(sp.days) >= 30 ? '30' : '7') : undefined
  const { warning, ...range } = parseOverviewRange({ ...sp, range: sp.range ?? legacy })
  const t = todayPeriod()
  const [today, todayUtil, incidents, data] = await Promise.all([overview(t), utilization(t), incidentStats(t), overviewData(range, sp.court)])
  const todayRate = todayUtil && todayUtil.courts.length ? Math.round(todayUtil.courts.reduce((s, c) => s + c.rate, 0) / todayUtil.courts.length) : null
  const by = new Map(incidents.byType.map((x) => [x.type, x.count]))
  const chart = CHARTS.includes(sp.chart as ChartKey) ? (sp.chart as ChartKey) : 'usage'

  return (
    <div className="space-y-6">
      <PageTitle title="營運總覽" desc="即時場館狀態" />
      <OperationsDashboard
        data={data}
        warning={warning}
        initialChart={chart}
        todayDate={taipeiDateString()}
        today={{ bookings: today.totals.orders, activeCourts: todayUtil?.courts.filter((c) => c.booked + c.event > 0).length ?? 0, rate: todayRate, revenue: today.totals.collected, incidents: incidents.open }}
        incidents={{ payment: (by.get('PAYMENT_FAILED') ?? 0) + (by.get('PAYMENT_AFTER_EXPIRY') ?? 0), notification: by.get('NOTIFICATION_FAILED') ?? 0, device: (by.get('DEVICE_OFFLINE') ?? 0) + (by.get('DEVICE_STALE') ?? 0), cancelled: today.cancelled }}
      />
      <SourceNote source="預約、付款、儲值、會員與異常事件紀錄" basis="使用率依 Reservation；營收＝訂單實收＋儲值實收，依付款成功時間；前期為緊鄰的同長度期間；時間以 Asia/Taipei" updatedAt={new Date()} />
    </div>
  )
}
