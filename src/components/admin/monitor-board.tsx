import Link from 'next/link'
import { AlertTriangle, CalendarClock, Cpu, Radar } from 'lucide-react'
import type { MonitorSnapshot } from '@/server/monitor-service'
import { Pill } from './page-bits'

const SENSOR_LABEL = { NOT_CONNECTED: '尚未串接', OCCUPIED: '偵測到有人', EMPTY: '未偵測到人', UNKNOWN: '狀態未知' } as const
const DEVICE_LABEL = { NOT_CONNECTED: '尚未串接', ONLINE: '在線', OFFLINE: '離線', UNKNOWN: '狀態未知' } as const
const DEVICE_TONE = { NOT_CONNECTED: 'gray', ONLINE: 'green', OFFLINE: 'red', UNKNOWN: 'amber' } as const

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')

/** 場地監測卡片（今日總覽與場地即時監測共用） */
export function MonitorBoard({ snap, compact = false }: { snap: MonitorSnapshot; compact?: boolean }) {
  const notConnected = snap.integration.mode === 'NOT_CONNECTED'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={notConnected ? 'gray' : 'violet'}>
          <Cpu className="h-3 w-3" aria-hidden />
          設備：{snap.integration.label}
        </Pill>
        <span className="text-muted">
          {notConnected ? snap.integration.reason : `設備最後回報 ${fmt(snap.lastDeviceUpdate)}`}・頁面資料 {fmt(snap.generatedAt)}
        </span>
      </div>
      <div className={compact ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-3 md:grid-cols-2'}>
        {snap.courts.map((c) => (
          <article key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{c.name}</h3>
              {c.courtStatus !== 'ACTIVE' && <Pill tone="amber">{c.courtStatus === 'MAINTENANCE' ? '維護中' : '停用'}</Pill>}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  依預約推估（非現場偵測）
                </dt>
                <dd className="mt-0.5">
                  {c.usage ? (
                    <>
                      <Pill tone={c.usage.kind === 'BLOCKED' ? 'amber' : 'blue'}>{c.usage.kind === 'BLOCKED' ? '封場中' : '預約使用中'}</Pill>{' '}
                      {c.usage.link ? <Link href={c.usage.link} className="hover:underline">{c.usage.label}</Link> : c.usage.label}
                      <span className="text-xs text-muted">　至 {c.usage.until.split(' ')[1]}</span>
                    </>
                  ) : (
                    <span className="text-muted">目前沒有預約</span>
                  )}
                </dd>
                {!compact && <dd className="mt-0.5 text-xs text-muted">報到：{c.checkIn}</dd>}
                {c.next && <dd className="mt-0.5 text-xs text-muted">下一筆：{c.next.at} {c.next.label}</dd>}
              </div>
              <div>
                <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                  <Radar className="h-3.5 w-3.5" aria-hidden />
                  感測器偵測
                </dt>
                <dd className="mt-0.5">
                  <Pill tone={c.sensor.state === 'NOT_CONNECTED' ? 'gray' : c.sensor.state === 'UNKNOWN' ? 'amber' : c.sensor.state === 'OCCUPIED' ? 'blue' : 'green'}>
                    {SENSOR_LABEL[c.sensor.state]}
                    {c.sensor.simulated ? '（模擬）' : ''}
                  </Pill>
                  {c.sensor.updatedAt && <span className="ml-1 text-xs text-muted">最後更新 {fmt(c.sensor.updatedAt)}</span>}
                </dd>
              </div>
              {c.mismatch && (
                <p className="flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {c.mismatch}
                </p>
              )}
              <div>
                <dt className="text-[11px] font-semibold text-muted">設備</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {c.devices.length === 0 ? (
                    <span className="text-xs text-muted">沒有設備紀錄</span>
                  ) : (
                    c.devices.map((d) => (
                      <Pill key={d.id} tone={DEVICE_TONE[d.state]}>
                        {d.typeLabel}：{DEVICE_LABEL[d.state]}
                        {d.state === 'UNKNOWN' && d.lastSeen ? `（最後 ${fmt(d.lastSeen)}）` : ''}
                        {d.state === 'ONLINE' && d.lastAction ? `・${d.lastAction}` : ''}
                      </Pill>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
