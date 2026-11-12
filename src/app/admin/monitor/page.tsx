import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { getMonitorSnapshot } from '@/server/monitor-service'
import { MonitorBoard } from '@/components/admin/monitor-board'
import { CameraMonitor } from '@/components/admin/camera-monitor'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { RefreshButtonLight } from '../refresh-light'

export const metadata: Metadata = { title: '即時監控' }
export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  if ((await pagePermission('monitor')) === 'forbidden') return <Forbidden />
  const snap = await getMonitorSnapshot()
  return (
    <div className="space-y-6">
      <PageTitle
        title="即時監控"
        desc="監控球館所有攝影機，查看實時監控影像與場地狀態。"
        right={<RefreshButtonLight />}
      />

      {/* 攝影機監控系統 */}
      <CameraMonitor />

      {/* 場地監測面板 */}
      {snap && (
        <div>
          <h2 className="text-sm font-semibold mb-4">場地狀態與設備</h2>
          <MonitorBoard snap={snap} compact />
        </div>
      )}
    </div>
  )
}
