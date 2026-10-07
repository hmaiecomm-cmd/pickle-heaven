import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { getMonitorSnapshot } from '@/server/monitor-service'
import { MonitorBoard } from '@/components/admin/monitor-board'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { RefreshButtonLight } from '../refresh-light'

export const metadata: Metadata = { title: '場地即時監測' }
export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  if ((await pagePermission('monitor')) === 'forbidden') return <Forbidden />
  const snap = await getMonitorSnapshot()
  return (
    <div>
      <PageTitle
        title="場地即時監測"
        desc="「依預約推估」來自訂單與活動；「感測器偵測」只有接上感測設備才有資料。資料逾時一律顯示狀態未知。"
        right={<RefreshButtonLight />}
      />
      {snap ? <MonitorBoard snap={snap} /> : <p className="text-sm text-muted">尚未建立場館。</p>}
    </div>
  )
}
