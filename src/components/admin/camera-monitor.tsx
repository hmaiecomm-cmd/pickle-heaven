'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Download, History, Video, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_HEIGHT, PLAN_WIDTH, ZONE_NAME } from '@/lib/venue-layout'
import { conePath, stepCamera, type CameraId } from '@/lib/camera-layout'
import type { CameraOverview, CameraView } from '@/server/camera-service'
import { VenuePlanBase } from './venue-plan-base'

const STATE_LABEL: Record<CameraView['state'], string> = { NOT_CONNECTED: '未連線（Demo）', ONLINE: '在線', OFFLINE: '離線' }
const SEVERITY: Record<string, { label: string; cls: string }> = {
  HIGH: { label: '高', cls: 'bg-red-50 text-red-700 ring-red-200' },
  MEDIUM: { label: '中', cls: 'bg-amber-50 text-amber-900 ring-amber-200' },
  LOW: { label: '低', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
}

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

type Mode = 'live' | 'playback'

/**
 * 即時監控：主畫面、平面圖標記、縮圖三者共用同一個「選取的攝影機」。
 * 尚未串接攝影機時只顯示示意畫面，不顯示 LIVE、不假裝在線。
 */
export function CameraMonitor({ overview, canExport }: { overview: CameraOverview; canExport: boolean }) {
  const { cameras, events, integration } = overview
  const [selected, setSelected] = React.useState<CameraId>(1)
  const [mode, setMode] = React.useState<Mode>('live')
  const cam = cameras.find((c) => c.id === selected) ?? cameras[0]

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setSelected((s) => stepCamera(s, 1))
    if (e.key === 'ArrowLeft') setSelected((s) => stepCamera(s, -1))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* 主監控影像 */}
        <section aria-label="主監控影像" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3" onKeyDown={onKey}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold">
              {cam.code}・{cam.name}
            </h2>
            <div role="tablist" aria-label="影像模式" className="flex rounded-lg bg-zinc-100 p-0.5 text-xs">
              {(
                [
                  ['live', '即時影像', Video],
                  ['playback', '歷史回放', History],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={cn('flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium', mode === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <DemoFrame camera={cam} large />
            <button
              type="button"
              aria-label="上一支攝影機"
              onClick={() => setSelected((s) => stepCamera(s, -1))}
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="下一支攝影機"
              onClick={() => setSelected((s) => stepCamera(s, 1))}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {mode === 'live' ? (
            <p className="mt-2 text-xs text-muted">
              拍攝範圍：{cam.coverage}・{integration.reason}
            </p>
          ) : (
            <Playback canExport={canExport} />
          )}
        </section>

        {/* 球館平面圖 */}
        <section aria-labelledby="cam-plan-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="cam-plan-title" className="text-sm font-semibold">
              球館平面圖
            </h2>
            <p className="text-[11px] text-muted">點選攝影機切換主畫面・安裝位置為示意</p>
          </div>
          <div>
            <svg viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`} className="h-auto w-full select-none" role="group" aria-label="攝影機位置平面圖">
              <VenuePlanBase />
              {cameras.map((c) => {
                const isSel = c.id === selected
                return (
                  <g
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${c.code} ${c.name}`}
                    aria-pressed={isSel}
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(c.id))}
                    className="cursor-pointer outline-none"
                  >
                    <path d={conePath(c)} fill={isSel ? '#16a34a' : '#71717a'} opacity={isSel ? 0.28 : 0.12} />
                    {isSel && <circle cx={c.x} cy={c.y} r="4.6" fill="#16a34a" opacity="0.2" />}
                    <circle cx={c.x} cy={c.y} r="3.1" fill={isSel ? '#15803d' : 'white'} stroke={isSel ? '#14532d' : '#52525b'} strokeWidth={isSel ? 0.6 : 0.4} />
                    <text x={c.x} y={c.y + 0.95} fontSize="2.7" fontWeight={800} fill={isSel ? 'white' : '#27272a'} textAnchor="middle">
                      {c.id}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted">位置</dt>
            <dd>{ZONE_NAME[cam.zone]}</dd>
            <dt className="text-muted">狀態</dt>
            <dd className="font-medium text-amber-700">{STATE_LABEL[cam.state]}</dd>
            <dt className="text-muted">型號</dt>
            <dd className="text-amber-700">{cam.model}</dd>
            <dt className="text-muted">最後回報</dt>
            <dd>{cam.lastSeen ? fmt(cam.lastSeen) : '—'}</dd>
          </dl>
        </section>
      </div>

      {/* 攝影機縮圖 */}
      <section aria-labelledby="cam-thumbs-title" className="rounded-2xl border border-zinc-200 bg-white p-3">
        <h2 id="cam-thumbs-title" className="mb-2 text-sm font-semibold">
          攝影機縮圖
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {cameras.map((c) => {
            const isSel = c.id === selected
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={isSel}
                onClick={() => setSelected(c.id)}
                className={cn(
                  'overflow-hidden rounded-xl border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342]',
                  isSel ? 'border-[#2f7d3b]' : 'border-zinc-200 hover:border-zinc-300',
                )}
              >
                <DemoFrame camera={c} />
                <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]">
                  <span className="truncate font-semibold">
                    {c.id}・{c.name}
                  </span>
                  <span className="shrink-0 text-zinc-500">未連線</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 攝影機狀態 */}
        <section aria-labelledby="cam-status-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white">
          <h2 id="cam-status-title" className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">
            攝影機狀態
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">攝影機</th>
                  <th className="px-2 py-2 font-medium">位置</th>
                  <th className="px-2 py-2 font-medium">狀態</th>
                  <th className="px-4 py-2 font-medium">最後回報</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cameras.map((c) => (
                  <tr key={c.id} className={cn('cursor-pointer hover:bg-zinc-50', c.id === selected && 'bg-[#f1f8ec]')} onClick={() => setSelected(c.id)}>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">
                      {c.code}・{c.name}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-zinc-600">{ZONE_NAME[c.zone]}</td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                        <VideoOff className="h-3 w-3" aria-hidden />
                        {STATE_LABEL[c.state]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{c.lastSeen ? fmt(c.lastSeen) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 異常事件 */}
        <section aria-labelledby="cam-events-title" className="min-w-0 rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <h2 id="cam-events-title" className="text-sm font-semibold">
              異常事件
            </h2>
            <Link href="/admin/incidents" className="text-xs font-medium text-[#2f7d3b] hover:underline">
              異常警示與處理紀錄 →
            </Link>
          </div>
          {events.length === 0 ? (
            <div className="px-4 py-6 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-zinc-700">
                <CircleCheck className="h-4 w-4 text-zinc-400" aria-hidden />
                目前沒有未處理的設備異常
              </p>
              <p className="mt-1 text-xs text-muted">攝影機尚未串接，因此不會產生攝影機離線、遮蔽、移位等事件；這不代表攝影機運作正常。</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {events.map((e) => {
                const sev = SEVERITY[e.severity] ?? SEVERITY.LOW
                const body = (
                  <>
                    <span className={cn('mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1', sev.cls)}>{sev.label}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.title}</span>
                      {e.detail && <span className="block truncate text-xs text-muted">{e.detail}</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">{fmt(e.createdAt)}</span>
                  </>
                )
                return (
                  <li key={e.id}>
                    {e.link ? (
                      <Link href={e.link} className="flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-zinc-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2 px-4 py-2.5 text-sm">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/** 示意畫面：明確標示 Demo Mode，非實際影像 */
function DemoFrame({ camera, large = false }: { camera: CameraView; large?: boolean }) {
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden bg-[#1c2620]', large && 'rounded-xl')} role="img" aria-label={`${camera.code} ${camera.name} 示意畫面（Demo Mode，非實際影像）`}>
      <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`demo-stripe-${camera.id}-${large ? 'l' : 's'}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="6" fill="#ffffff" opacity="0.025" />
          </pattern>
        </defs>
        <rect width="160" height="90" fill={`url(#demo-stripe-${camera.id}-${large ? 'l' : 's'})`} />
        <path d="M20 82 L58 40 L102 40 L140 82 Z" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.8" />
        <line x1="80" y1="40" x2="80" y2="82" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.6" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
        <VideoOff className={cn('text-white/50', large ? 'h-9 w-9' : 'h-5 w-5')} aria-hidden />
        <p className={cn('font-bold tracking-wide text-white/85', large ? 'text-lg' : 'text-[11px]')}>{camera.code}</p>
        {large && <p className="text-sm text-white/70">{camera.name}</p>}
      </div>
      <span className={cn('absolute left-2 top-2 rounded-md bg-amber-400 font-bold text-amber-950', large ? 'px-2 py-0.5 text-xs' : 'px-1.5 text-[9px]')}>Demo Mode</span>
      {large && <span className="absolute bottom-2 right-3 text-[11px] text-white/60">示意畫面・非實際影像・未連線</span>}
    </div>
  )
}

function Playback({ canExport }: { canExport: boolean }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-1 block text-muted">日期</span>
          <input type="date" defaultValue={today} max={today} disabled className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm disabled:opacity-60" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted">開始時間</span>
          <input type="time" defaultValue="18:00" disabled className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm disabled:opacity-60" />
        </label>
        <button type="button" disabled className="h-9 rounded-lg bg-zinc-300 px-3 text-sm font-semibold text-white">
          播放
        </button>
        <button
          type="button"
          disabled
          title={canExport ? '尚未串接錄影主機' : '需要「影像匯出」權限'}
          className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-400"
        >
          <Download className="h-4 w-4" aria-hidden />
          匯出影像
        </button>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        尚未串接錄影主機（NVR），目前沒有任何錄影可回放或匯出。
        {!canExport && '　另外，目前角色沒有「影像匯出」權限。'}
      </p>
    </div>
  )
}
