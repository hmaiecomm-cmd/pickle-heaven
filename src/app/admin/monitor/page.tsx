import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { getMonitorSnapshot } from '@/server/monitor-service'
import { getCameraOverview } from '@/server/camera-service'
import { MonitorBoard } from '@/components/admin/monitor-board'
import { CameraMonitor } from '@/components/admin/camera-monitor'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { RefreshButtonLight } from '../refresh-light'

export const metadata: Metadata = { title: '即時監控' }
export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return <Forbidden />
  const [cameras, snap] = await Promise.all([getCameraOverview(), getMonitorSnapshot()])
  return (
    <div className="space-y-5">
      <PageTitle title="即時監控" desc="球館平面圖、Camera 1–6、歷史回放、攝影機狀態與異常事件。" right={<RefreshButtonLight />} />
      <DemoModeBanner what="攝影機與錄影主機" />

      <CameraMonitor overview={cameras} canExport={can(ctx.role, 'camera.export')} />

      {snap && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">場地狀態與設備</h2>
          <MonitorBoard snap={snap} compact />
        </section>
      )}
    </div>
  )
}
