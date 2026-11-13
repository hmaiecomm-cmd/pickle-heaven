'use client'

import * as React from 'react'
import { Camera, Download, Expand, Minimize, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cameraTitle } from '@/lib/camera-layout'
import type { CameraView } from '@/server/camera-service'
import { useToast } from '@/components/ui/toast'
import { CameraFrame } from '@/components/admin/monitor/camera-frame'
import { downloadSnapshot, toggleFullscreen } from '@/components/admin/monitor/snapshot'
import { downloadClipAction, playbackAction, snapshotAction } from './actions'

const SPEEDS = [0.5, 1, 2, 4, 8] as const
const DAY = 24 * 3600
const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
const clock = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

type Playback = { connected: false; segments: { start: string; end: string }[]; message: string }

/**
 * 歷史回放。錄影片段一律向伺服器查詢（目前沒有 NVR，回傳空的），時間軸、播放控制可正常操作，
 * 但畫面清楚標示「沒有錄影」與「示範影像」，不假裝在播放真實錄影。
 */
export function PlaybackView({ cameras, initialCameraId, canExport }: { cameras: CameraView[]; initialCameraId: string; canExport: boolean }) {
  const { toast } = useToast()
  const [cameraId, setCameraId] = React.useState(cameras.some((c) => c.id === initialCameraId) ? initialCameraId : cameras[0]?.id)
  const [date, setDate] = React.useState(today)
  const [cursor, setCursor] = React.useState(18 * 3600)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]>(1)
  const [data, setData] = React.useState<Playback | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const cam = cameras.find((c) => c.id === cameraId)

  React.useEffect(() => {
    if (!cameraId) return
    let alive = true
    setLoading(true)
    setPlaying(false)
    playbackAction(cameraId, date).then((r) => {
      if (!alive) return
      setLoading(false)
      if (r.ok) setData(r.data)
      else {
        setData(null)
        toast(r.error, 'error')
      }
    })
    return () => {
      alive = false
    }
  }, [cameraId, date, toast])

  React.useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setCursor((c) => Math.min(DAY - 1, c + speed / 4)), 250)
    return () => window.clearInterval(t)
  }, [playing, speed])

  React.useEffect(() => {
    if (cursor >= DAY - 1) setPlaying(false)
  }, [cursor])

  React.useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  if (!cam) return <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-muted">目前角色沒有可回放的攝影機。</p>

  const stamp = `${date} ${clock(cursor)}`
  const hasRecording = (data?.segments.length ?? 0) > 0

  const download = async () => {
    const r = await downloadClipAction(cam.id, date, clock(cursor))
    toast(r.ok ? '已開始下載' : r.error, r.ok ? 'success' : 'error')
  }
  const snapshot = async () => {
    const r = await snapshotAction(cam.id, stamp)
    if (!r.ok) return toast(r.error, 'error')
    await downloadSnapshot({ title: cameraTitle(cam.id, cam.name), imageSrc: cam.demo?.main ?? null, objectPosition: cam.demo?.mainPosition, stamp: `回放時間 ${stamp}`, fileName: `camera-${cam.id}-${date}-demo.png` })
    toast('已下載截圖（示範影像）', 'success')
  }

  return (
    <section aria-label="歷史回放" className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted">攝影機</span>
          <select value={cam.id} onChange={(e) => setCameraId(e.target.value)} className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-sm">
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}｜{c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted">日期</span>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-sm" />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {canExport && (
            <>
              <IconButton label="截圖" icon={Camera} onClick={snapshot} />
              <IconButton label="下載影像" icon={Download} onClick={download} />
            </>
          )}
          <IconButton label={fullscreen ? '離開全螢幕' : '全螢幕'} icon={fullscreen ? Minimize : Expand} onClick={() => toggleFullscreen(stageRef.current)} />
        </div>
      </div>

      <div ref={stageRef} className={cn('relative overflow-hidden rounded-xl bg-[#1d2620]', fullscreen && 'flex items-center justify-center rounded-none')}>
        <CameraFrame
          camera={cam}
          variant="main"
          className={fullscreen ? 'max-h-screen' : undefined}
          overlay={
            <>
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-white">
                <p className="text-base font-semibold sm:text-lg">{loading ? '查詢錄影中…' : hasRecording ? '' : '此時間點沒有錄影'}</p>
                <p className="text-xs text-white/80">{data?.message ?? ''}</p>
              </div>
              <div className="absolute bottom-12 right-3 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white" data-testid="playhead">
                {stamp}
                {playing ? `・${speed}x` : '・暫停'}
              </div>
            </>
          }
        />
      </div>

      {/* 時間軸 */}
      <div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="回放時間軸"
          aria-valuemin={0}
          aria-valuemax={DAY - 1}
          aria-valuenow={Math.floor(cursor)}
          aria-valuetext={clock(cursor)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setCursor(Math.round(((e.clientX - r.left) / r.width) * (DAY - 1)))
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setCursor((c) => Math.min(DAY - 1, c + 60))
            if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 60))
          }}
          className="relative h-10 cursor-pointer rounded-lg bg-zinc-100 ring-1 ring-zinc-200"
        >
          {/* 錄影片段（目前沒有） */}
          {data?.segments.map((s) => {
            const toSec = (iso: string) => {
              const d = new Date(iso)
              return d.getHours() * 3600 + d.getMinutes() * 60
            }
            return <span key={s.start} className="absolute inset-y-1 rounded bg-[#7cb342]" style={{ left: `${(toSec(s.start) / DAY) * 100}%`, width: `${((toSec(s.end) - toSec(s.start)) / DAY) * 100}%` }} />
          })}
          {!loading && !hasRecording && <span className="absolute inset-0 grid place-items-center text-[11px] text-zinc-500">無錄影資料（尚未串接 NVR）</span>}
          {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
            <span key={h} className="absolute bottom-0 top-0 border-l border-zinc-300/70" style={{ left: `${(h / 24) * 100}%` }} />
          ))}
          <span className="absolute -top-1 bottom-[-4px] w-0.5 bg-[#2f7d3b]" style={{ left: `${(cursor / DAY) * 100}%` }}>
            <span className="absolute -left-1.5 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2f7d3b] shadow" />
          </span>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i}>{pad(i * 3)}:00</span>
          ))}
        </div>
      </div>

      {/* 播放控制 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <IconButton label="倒退 30 秒" icon={RotateCcw} onClick={() => setCursor((c) => Math.max(0, c - 30))} compact />
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? '暫停' : '播放'}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#2f7d3b] text-white shadow-sm hover:bg-[#276a32]"
        >
          {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
        </button>
        <IconButton label="快轉 30 秒" icon={RotateCw} onClick={() => setCursor((c) => Math.min(DAY - 1, c + 30))} compact />
        <div role="radiogroup" aria-label="播放速度" className="ml-2 flex rounded-lg bg-zinc-100 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              onClick={() => setSpeed(s)}
              className={cn('h-8 min-w-10 rounded-md px-2 text-xs font-semibold', speed === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500')}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
      {!canExport && <p className="text-center text-[11px] text-muted">下載影像與截圖需要「影像下載與截圖」權限。</p>}
    </section>
  )
}

function IconButton({ label, icon: Icon, onClick, compact }: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50', compact ? 'w-10 justify-center' : 'px-3')}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {!compact && label}
    </button>
  )
}
