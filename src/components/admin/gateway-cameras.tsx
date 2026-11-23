'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HlsPlayer } from '@/components/admin/hls-player'

interface Cam {
  id: string
  name: string
}
interface Rec {
  camera: string
  start: string
  end: string
  kind: 'continuous' | 'motion'
}

async function call<T = any>(body?: Record<string, unknown>, query = ''): Promise<T> {
  const r = await fetch(`/api/admin/iot/camera${query}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
  return j
}
const media = (site: string, session: string) => `/api/admin/engineer/media/${site}/${session}/index.m3u8`
const tpe = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' })

/** 即時影像：點一支（或六支）向場館要直播；觀看中自動延長，離開頁面就停止 */
export function GatewayLive({ cameras }: { cameras: Cam[] }) {
  const [live, setLive] = useState<Record<string, { session: string; site: string }>>({})
  const [err, setErr] = useState<string | null>(null)
  const liveRef = useRef(live)
  liveRef.current = live

  const start = useCallback(async (cam: string) => {
    try {
      const r = await call<{ session: string; site: string }>({ action: 'live', camera: cam })
      setLive((l) => ({ ...l, [cam]: r }))
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])
  const stop = useCallback(async (cam: string) => {
    const s = liveRef.current[cam]
    setLive((l) => {
      const n = { ...l }
      delete n[cam]
      return n
    })
    if (s) await call({ action: 'stop', session: s.session }).catch(() => {})
  }, [])

  // 觀看中每 90 秒延長一次（直播單次 120 秒）
  useEffect(() => {
    const t = setInterval(() => {
      for (const [cam, s] of Object.entries(liveRef.current)) void call({ action: 'renew', camera: cam, session: s.session }).catch(() => {})
    }, 90_000)
    return () => {
      clearInterval(t)
      for (const s of Object.values(liveRef.current)) void call({ action: 'stop', session: s.session }).catch(() => {})
    }
  }, [])

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold">場館即時影像（經 IoT Gateway）</h3>
        <button type="button" className="rounded border px-2.5 py-1 text-xs hover:bg-zinc-50" onClick={() => cameras.forEach((c) => !live[c.id] && void start(c.id))}>
          六路全開
        </button>
        <button type="button" className="rounded border px-2.5 py-1 text-xs hover:bg-zinc-50" onClick={() => Object.keys(live).forEach((c) => void stop(c))}>
          全部停止
        </button>
        {err && <span className="text-xs text-red-700">{err}</span>}
        <span className="ml-auto text-xs text-muted">影像從場館電腦主動上傳（約 4–6 秒延遲）；離開頁面自動停止。</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cameras.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-lg border">
            {live[c.id] ? (
              <HlsPlayer src={media(live[c.id].site, live[c.id].session)} className="aspect-video" onError={setErr} />
            ) : (
              <button type="button" className="flex aspect-video w-full items-center justify-center bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800" onClick={() => void start(c.id)}>
                ▶ 觀看 CAM{c.id}
              </button>
            )}
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span>
                CAM{c.id}・{c.name}
              </span>
              {live[c.id] && (
                <button type="button" className="underline" onClick={() => void stop(c.id)}>
                  停止
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 錄影回放：選攝影機與日期 → 向 NVR 要索引（14 天）→ 點時間軸調閱 2 分鐘 */
export function GatewayPlayback({ cameras }: { cameras: Cam[] }) {
  const [cam, setCam] = useState(cameras[0]?.id ?? '01')
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + 8 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10))
  const [day, setDay] = useState(days[0])
  const [recs, setRecs] = useState<Rec[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [clip, setClip] = useState<{ site: string; session: string; ready: boolean; title: string } | null>(null)

  const dayStart = Date.parse(`${day}T00:00:00+08:00`)
  const dayEnd = Math.min(dayStart + 86_400_000, Date.now())

  async function loadIndex() {
    setRecs(null)
    setMsg('向 NVR 查詢錄影索引…')
    try {
      const { id } = await call<{ id: string }>({ action: 'index', cameras: [cam], from: new Date(Math.max(dayStart, Date.now() - 14 * 86_400_000 + 60_000)).toISOString(), to: new Date(dayEnd).toISOString() })
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1_000))
        const c = await call<any>(undefined, `?view=command&id=${id}`)
        if (c.status === 'ACKED') {
          const idx = await call<{ recordings: Rec[] }>(undefined, `?view=index&id=${id}`)
          setRecs(idx.recordings)
          setMsg(null)
          return
        }
        if (['FAILED', 'REJECTED', 'EXPIRED'].includes(c.status)) throw new Error(c.ack?.error ?? `場館回應 ${c.status}`)
      }
      throw new Error('場館沒有回應（可能離線）')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function play(at: number) {
    const from = Math.max(dayStart, Math.min(at, dayEnd - 120_000))
    setMsg('向 NVR 調閱錄影…')
    try {
      const r = await call<{ site: string; session: string }>({ action: 'clip', camera: cam, from: new Date(from).toISOString(), to: new Date(from + 120_000).toISOString() })
      setClip({ ...r, ready: false, title: `CAM${cam} ${day} ${tpe(new Date(from).toISOString())} 起 2 分鐘` })
      for (let i = 0; i < 90; i++) {
        await new Promise((res) => setTimeout(res, 1_000))
        const m = await call<any>(undefined, `?view=media&session=${r.session}`)
        if (m.ended) {
          if (m.endReason !== 'COMPLETED') throw new Error(`調閱失敗：${m.endReason}`)
          setClip((c) => (c ? { ...c, ready: true } : c))
          setMsg(null)
          return
        }
        setMsg(`場館上傳中… ${m.segments} 片`)
      }
      throw new Error('調閱逾時')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const pct = (t: number) => ((t - dayStart) / 86_400_000) * 100
  const motions = (recs ?? []).filter((r) => r.kind === 'motion')
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <h3 className="text-[13px] font-semibold">NVR 錄影回放（保存 14 天，經 IoT Gateway）</h3>
        <select className="rounded border px-2 py-1" value={cam} onChange={(e) => (setCam(e.target.value), setRecs(null))}>
          {cameras.map((c) => (
            <option key={c.id} value={c.id}>
              CAM{c.id} {c.name}
            </option>
          ))}
        </select>
        <select className="rounded border px-2 py-1" value={day} onChange={(e) => (setDay(e.target.value), setRecs(null))}>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button type="button" className="rounded bg-zinc-900 px-3 py-1 text-white" onClick={() => void loadIndex()}>
          查詢錄影
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
      {recs && (
        <div className="mb-3">
          <div
            className="relative h-8 cursor-pointer rounded bg-emerald-100"
            title="點時間軸調閱該時間起 2 分鐘"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              void play(dayStart + ((e.clientX - r.left) / r.width) * 86_400_000)
            }}
          >
            {motions.map((m, i) => (
              <i key={i} className="absolute inset-y-0 bg-amber-500" style={{ left: `${pct(Date.parse(m.start))}%`, width: `${Math.max(0.3, pct(Date.parse(m.end)) - pct(Date.parse(m.start)))}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
              <span key={h}>{String(h).padStart(2, '0')}</span>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            綠＝連續錄影、橘＝位移事件（{motions.length} 段）。點時間軸任一處調閱該時間起 2 分鐘。
          </p>
          {motions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {motions.slice(0, 30).map((m, i) => (
                <button key={i} type="button" className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-amber-50" onClick={() => void play(Date.parse(m.start))}>
                  {tpe(m.start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {clip?.ready && (
        <div>
          <p className="mb-1 text-xs font-semibold">{clip.title}</p>
          <HlsPlayer src={media(clip.site, clip.session)} live={false} className="aspect-video w-full max-w-3xl rounded" />
        </div>
      )}
    </div>
  )
}
