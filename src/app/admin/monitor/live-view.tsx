'use client'

import * as React from 'react'
import Link from 'next/link'
import { Camera, ChevronLeft, ChevronRight, Expand, History, LayoutGrid, Minimize, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cameraTitle, stepCamera } from '@/lib/camera-layout'
import { ZONE_NAME } from '@/lib/venue-layout'
import type { CameraView } from '@/server/camera-service'
import { useToast } from '@/components/ui/toast'
import { CameraFrame } from '@/components/admin/monitor/camera-frame'
import { CameraPlan } from '@/components/admin/monitor/camera-plan'
import { downloadSnapshot, nowStamp, toggleFullscreen } from '@/components/admin/monitor/snapshot'
import { snapshotAction } from './actions'

type Layout = 'single' | 'grid'

/**
 * 即時影像：主畫面、六路縮圖、平面圖標記共用同一個 selectedCameraId。
 */
export function LiveView({ cameras, initialCameraId, canExport, canPlayback }: { cameras: CameraView[]; initialCameraId: string; canExport: boolean; canPlayback: boolean }) {
  const { toast } = useToast()
  const ids = cameras.map((c) => c.id)
  const [selectedCameraId, setSelectedCameraId] = React.useState(ids.includes(initialCameraId as CameraView['id']) ? initialCameraId : ids[0])
  const [layout, setLayout] = React.useState<Layout>('single')
  const [fullscreen, setFullscreen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const cam = cameras.find((c) => c.id === selectedCameraId) ?? cameras[0]

  React.useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  // 網址記住目前的攝影機，重新整理或分享連結時停在同一支
  React.useEffect(() => {
    const u = new URL(window.location.href)
    u.searchParams.set('cam', selectedCameraId)
    window.history.replaceState(null, '', u)
  }, [selectedCameraId])

  if (!cam) return <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-muted">目前角色沒有可觀看的攝影機。</p>

  const select = (id: string) => {
    setSelectedCameraId(id)
    setLayout('single')
  }
  const step = (d: 1 | -1) => setSelectedCameraId((s) => stepCamera(ids, s as CameraView['id'], d))

  const snapshot = async () => {
    setBusy(true)
    const stamp = nowStamp()
    const r = await snapshotAction(cam.id, stamp)
    if (!r.ok) {
      toast(r.error, 'error')
    } else {
      try {
        await downloadSnapshot({ title: cameraTitle(cam.id, cam.name), imageSrc: cam.demo?.main ?? null, objectPosition: cam.demo?.mainPosition, stamp, fileName: `camera-${cam.id}-demo-snapshot.png` })
        toast('已下載截圖（示範影像）', 'success')
      } catch (e) {
        toast(e instanceof Error ? e.message : '截圖失敗', 'error')
      }
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_252px]">
        {/* 主監控畫面 */}
        <section aria-label="主要監控影像" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <h2 className="truncate text-[15px] font-semibold" data-testid="main-title">
                {layout === 'grid' ? '多畫面（6 路）' : cameraTitle(cam.id, cam.name)}
              </h2>
              <p className="text-[11px] text-muted">{layout === 'grid' ? '點任一畫面切換為主畫面' : `${ZONE_NAME[cam.zone as keyof typeof ZONE_NAME] ?? cam.zone}・${cam.enabled ? '未連線（Demo Mode）' : '已停用'}`}</p>
            </div>
            <div role="radiogroup" aria-label="畫面模式" className="flex rounded-lg bg-zinc-100 p-0.5">
              {(
                [
                  ['single', '單畫面', Square],
                  ['grid', '多畫面', LayoutGrid],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={layout === key}
                  onClick={() => setLayout(key)}
                  className={cn('flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium', layout === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {canExport && (
              <ToolButton label="截圖" icon={Camera} onClick={snapshot} disabled={busy || layout === 'grid'} />
            )}
            <ToolButton label={fullscreen ? '離開全螢幕' : '全螢幕'} icon={fullscreen ? Minimize : Expand} onClick={() => toggleFullscreen(stageRef.current)} />
          </div>

          <div
            ref={stageRef}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') step(1)
              if (e.key === 'ArrowLeft') step(-1)
            }}
            className={cn('relative overflow-hidden rounded-xl bg-[#1d2620] outline-none', fullscreen && 'flex items-center justify-center rounded-none')}
          >
            {layout === 'single' ? (
              <>
                <CameraFrame camera={cam} variant="main" className={fullscreen ? 'max-h-screen' : undefined} />
                <ArrowButton side="left" onClick={() => step(-1)} />
                <ArrowButton side="right" onClick={() => step(1)} />
              </>
            ) : (
              <div className={cn('grid grid-cols-3 gap-1 p-1', fullscreen && 'w-full')}>
                {cameras.map((c) => (
                  <button key={c.id} type="button" onClick={() => select(c.id)} className="relative overflow-hidden rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342]" aria-label={`切換到 ${cameraTitle(c.id, c.name)}`}>
                    <CameraFrame camera={c} variant="grid" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-[11px] font-semibold text-white">
                      {c.id}・{c.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 六路攝影機縮圖 */}
        <section aria-labelledby="thumbs-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
          <h2 id="thumbs-title" className="mb-2 text-[13px] font-semibold">
            六路攝影機
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-2">
            {cameras.map((c) => {
              const isSel = layout === 'single' && c.id === selectedCameraId
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={isSel}
                  data-camera={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    'overflow-hidden rounded-xl border-2 bg-white text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342]',
                    isSel ? 'border-[#2f7d3b] shadow-[0_0_0_3px_rgba(124,179,66,0.25)]' : 'border-transparent ring-1 ring-zinc-200 hover:ring-zinc-300',
                  )}
                >
                  <CameraFrame camera={c} variant="thumb" />
                  <span className="flex items-center gap-1 px-1.5 py-1 text-[11px] leading-tight">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.enabled ? 'bg-zinc-400' : 'bg-red-400')} aria-hidden />
                    <span className="truncate font-semibold">
                      {c.id} {c.name}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="plan-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="plan-title" className="text-[13px] font-semibold">
              場館平面圖
            </h2>
            <p className="text-[11px] text-muted">點標記切換主畫面</p>
          </div>
          <CameraPlan cameras={cameras} selectedId={layout === 'single' ? selectedCameraId : ''} onSelect={select} />
        </section>

        <section aria-labelledby="info-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
          <h2 id="info-title" className="text-[13px] font-semibold">
            {cameraTitle(cam.id, cam.name)}
          </h2>
          <dl className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2 text-sm">
            <dt className="text-muted">區域</dt>
            <dd>{ZONE_NAME[cam.zone as keyof typeof ZONE_NAME] ?? cam.zone}</dd>
            <dt className="text-muted">拍攝範圍</dt>
            <dd>{cam.coverage || '—'}</dd>
            <dt className="text-muted">連線狀態</dt>
            <dd className={cam.enabled ? 'font-medium text-amber-700' : 'font-medium text-red-600'}>{cam.enabled ? '未連線（Demo Mode）' : '已停用'}</dd>
            <dt className="text-muted">畫面來源</dt>
            <dd>{cam.demo ? '現場照片（示範影像，非即時）' : '無（尚未串接）'}</dd>
          </dl>
          {canPlayback && (
            <Link href={`/admin/monitor?tab=playback&cam=${cam.id}`} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-[#2f7d3b] hover:bg-zinc-50">
              <History className="h-4 w-4" aria-hidden />
              查看這支的歷史回放
            </Link>
          )}
        </section>
      </div>
    </div>
  )
}

function ToolButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}

function ArrowButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={side === 'left' ? '上一支攝影機' : '下一支攝影機'}
      onClick={onClick}
      className={cn('absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60', side === 'left' ? 'left-2' : 'right-2')}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
