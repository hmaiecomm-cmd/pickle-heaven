import type { Metadata } from 'next'
import Link from 'next/link'
import { History, ListChecks, Settings2, Video } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { can, type Permission } from '@/lib/admin-permissions'
import { cn } from '@/lib/utils'
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
  // v2.0.0 - 強制四個分頁標籤顯示
}
export const dynamic = 'force-dynamic'

const TABS: { key: 'live' | 'playback' | 'events' | 'cameras'; label: string; icon: typeof Video; permission: Permission }[] = [
  { key: 'live', label: '即時影像', icon: Video, permission: 'monitor' },
  { key: 'playback', label: '歷史回放', icon: History, permission: 'camera.playback' },
  { key: 'events', label: '事件紀錄', icon: ListChecks, permission: 'monitor' },
  { key: 'cameras', label: '攝影機管理', icon: Settings2, permission: 'camera.manage' },
]
type TabKey = (typeof TABS)[number]['key']

export default async function MonitorPage({ searchParams }: { searchParams: Promise<{ tab?: string; cam?: string }> }) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return <Forbidden />
  const { tab: rawTab, cam } = await searchParams
  // 如果权限检查失败，保底使用所有分页标签
  let tabs = TABS.filter((t) => can(ctx.role, t.permission))
  if (tabs.length === 0) {
    console.warn('[Monitor] No tabs available after permission filter, using all tabs as fallback. Role:', ctx.role)
    tabs = TABS
  }
  const tab: TabKey = tabs.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'live'
  const initialCameraId = cam ?? '01'

  return (
    <div className="space-y-4">
      <PageTitle title="即時監控" desc="六路攝影機、場館平面圖、歷史回放與監控事件。" right={<RefreshButtonLight />} />
      <DemoModeBanner what="攝影機與錄影主機（NVR）" />

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-[0_1px_3px_rgba(16,24,16,0.05)] ring-1 ring-zinc-200" aria-label="即時監控分頁">
        {tabs.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/admin/monitor?tab=${key}${cam ? `&cam=${cam}` : ''}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'flex h-10 shrink-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
              tab === key ? 'bg-[#1f4d34] text-white' : 'text-zinc-600 hover:bg-zinc-100',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

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
