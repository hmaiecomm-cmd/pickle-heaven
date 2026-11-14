import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can, type Permission } from '@/lib/admin-permissions'
import { getMonitorSnapshot } from '@/server/monitor-service'
import { listCameras, listCamerasForAdmin, listMonitorAudit, listMonitorEvents } from '@/server/camera-service'
import { MonitorBoard } from '@/components/admin/monitor-board'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { RefreshButtonLight } from '../refresh-light'
import { LiveView } from './live-view'
import { PlaybackView } from './playback-view'
import { EventsView } from './events-view'
import { CamerasManager } from './cameras-manager'

export const metadata: Metadata = {
  title: '即時監控',
}
export const dynamic = 'force-dynamic'

// 分頁切換在左側選單（admin-nav.ts），這裡只依 ?tab= 與權限決定顯示內容
const TABS: { key: 'live' | 'playback' | 'events' | 'cameras'; permission: Permission }[] = [
  { key: 'live', permission: 'monitor' },
  { key: 'playback', permission: 'camera.playback' },
  { key: 'events', permission: 'monitor' },
  { key: 'cameras', permission: 'camera.manage' },
]
type TabKey = (typeof TABS)[number]['key']

export default async function MonitorPage({ searchParams }: { searchParams: Promise<{ tab?: string; cam?: string }> }) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return <Forbidden />
  const { tab: rawTab, cam } = await searchParams
  const tabs = TABS.filter((t) => can(ctx.role, t.permission))
  const tab: TabKey = tabs.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'live'
  const initialCameraId = cam ?? '01'

  return (
    <div className="space-y-4">
      <PageTitle title="即時監控" desc="六路攝影機、場館平面圖、歷史回放與監控事件。" right={<RefreshButtonLight />} />
      <DemoModeBanner what="攝影機與錄影主機（NVR）" />

      {tab === 'live' && <LiveTab role={ctx.role} initialCameraId={initialCameraId} />}
      {tab === 'playback' && <PlaybackView cameras={(await listCameras(ctx.role)).cameras} initialCameraId={initialCameraId} canExport={can(ctx.role, 'camera.export')} />}
      {tab === 'events' && <EventsView events={await listMonitorEvents()} audit={await listMonitorAudit()} canHandle={can(ctx.role, 'monitor.events')} />}
      {tab === 'cameras' && <CamerasTab />}
    </div>
  )
}

async function LiveTab({ role, initialCameraId }: { role: string; initialCameraId: string }) {
  const [{ cameras }, snap] = await Promise.all([listCameras(role), getMonitorSnapshot()])
  return (
    <>
      <LiveView cameras={cameras} initialCameraId={initialCameraId} canExport={can(role, 'camera.export')} canPlayback={can(role, 'camera.playback')} />
      {snap && (
        <details className="group rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold">
            場地狀態與設備 <span className="text-xs font-normal text-muted">（依預約推估與感測器，點此展開）</span>
          </summary>
          <div className="border-t border-zinc-100 p-4">
            <MonitorBoard snap={snap} compact />
          </div>
        </details>
      )}
    </>
  )
}

async function CamerasTab() {
  const { cameras, storage } = await listCamerasForAdmin()
  return <CamerasManager cameras={cameras} storage={storage} />
}
