'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CommandRecord, EdgeCommand, MediaSessionInfo, TrafficEntry } from '@gh/iot-contract'
import { HlsPlayer } from '@/components/admin/hls-player'
import { Bench, SCENARIOS, type Overview, type Scenario } from './bench'

type Target = 'LIVE' | 'SIMULATOR'
interface Venue {
  id: string
  name: string
  siteCode: string
  target: Target
}

const TABS = [
  { id: 'mirror', label: '場館鏡像' },
  { id: 'down', label: '下行參數' },
  { id: 'traffic', label: '上行／下行流量' },
  { id: 'errors', label: '錯誤 log' },
  { id: 'bench', label: '測試台' },
  { id: 'cameras', label: '攝影機' },
] as const

const KIND: Record<string, string> = { COURT: '球場', BUSINESS: '營業', NIGHT: '夜間', ALWAYS_ON: '24h', RESERVED: '預留' }
const tpe = (iso?: string | null, sec = true) =>
  iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}) }) : '—'
const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const pill = (cls: string, text: string) => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>
const OK = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
const BAD = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
const WARN = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
const INFO = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
const statusPill = (s: string) => pill(s === 'ACKED' ? OK : s === 'EXPIRED' ? WARN : s === 'QUEUED' || s === 'DELIVERED' ? INFO : BAD, s)

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { cache: 'no-store', ...init })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
  return j
}

export function EngineerClient({ venues, configured, gatewayUrl }: { venues: Venue[]; configured: boolean; gatewayUrl: string | null }) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('mirror')
  const [ov, setOv] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const q = (view: string, extra = '') => api(`/api/admin/engineer?venue=${encodeURIComponent(venueId)}&view=${view}${extra}`)
  const post = (body: Record<string, unknown>) => api('/api/admin/engineer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venue: venueId, ...body }) })

  const load = useCallback(async () => {
    if (!venueId || !configured) return
    try {
      setOv(await api(`/api/admin/engineer?venue=${encodeURIComponent(venueId)}&view=overview`))
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [venueId, configured])
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 3_000)
    return () => clearInterval(t)
  }, [load])

  if (!configured) return <Box>尚未設定 IoT Gateway（IOT_GATEWAY_URL、IOT_PLATFORM_SECRET）。本機測試請先執行 <code>npm run iot:stack</code> 再重新啟動 <code>npm run dev</code>。</Box>
  if (venues.length === 0) return <Box>還沒有場館設定場館代碼（Venue.siteCode）。開發庫可執行 <code>npm run iot:dev:setup</code>。</Box>

  const target = ov?.venue.target ?? venues.find((v) => v.id === venueId)?.target ?? 'LIVE'
  async function switchTo(t: Target) {
    if (t === target) return
    if (t === 'LIVE' && !confirm('切回「實體 IoT PC」？之後所有計畫與指令都會送到場館的真實設備。')) return
    setBusy(true)
    try {
      await post({ action: 'target', target: t })
      await load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Box>
        <div className="flex flex-wrap items-center gap-3">
          {venues.length > 1 && (
            <select className="rounded border bg-background px-2 py-1.5 text-sm" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm font-semibold">連線對象</span>
          <div className="inline-flex overflow-hidden rounded-lg border">
            {(['LIVE', 'SIMULATOR'] as Target[]).map((t) => {
              const s = ov?.sites?.[t]
              const on = target === t
              return (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => void switchTo(t)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm ${on ? (t === 'LIVE' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'bg-background hover:bg-muted'}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${s?.online ? 'bg-green-400' : 'bg-gray-400'}`} />
                  {t === 'LIVE' ? '實體 IoT PC' : '網頁模擬器'}
                  <span className="font-mono text-xs opacity-80">{t === 'LIVE' ? ov?.venue.siteCode : `${ov?.venue.siteCode ?? ''}-sim`}</span>
                </button>
              )
            })}
          </div>
          {target === 'SIMULATOR' && (
            <a className="text-sm underline" href="http://127.0.0.1:4310" target="_blank" rel="noreferrer">
              開啟模擬器畫面（本機 :4310）
            </a>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Gateway {gatewayUrl}</span>
        </div>
        {target === 'LIVE' && <p className="mt-2 text-xs text-red-700 dark:text-red-400">目前連的是實體場館電腦：測試台會動到現場設備的情境，執行前會再確認一次；只限模擬器的情境不會執行。</p>}
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      </Box>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mirror' && <Mirror ov={ov} post={post} target={target} q={q} />}
      {tab === 'down' && <Downlink ov={ov} q={q} post={post} />}
      {tab === 'traffic' && <Traffic q={q} />}
      {tab === 'errors' && <Errors q={q} />}
      {tab === 'bench' && <BenchPanel venueId={venueId} target={target} />}
      {tab === 'cameras' && <Cameras ov={ov} q={q} post={post} />}
    </div>
  )
}

function Box({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>{children}</div>
}

// ─────────────────────────── 鏡像 ───────────────────────────

function Mirror({ ov, post, target, q }: { ov: Overview | null; post: (b: Record<string, unknown>) => Promise<any>; target: Target; q: (v: string, e?: string) => Promise<any> }) {
  const [note, setNote] = useState<string | null>(null)
  if (!ov) return <Box>讀取中…</Box>
  const a = ov.active
  const st = a?.status
  const quick = async (command: EdgeCommand, label: string) => {
    try {
      const live = target === 'LIVE' && ['door.unlock', 'audio.play'].includes(command.type)
      if (live && !confirm(`對實體場館執行「${label}」？`)) return
      const r = await post({ action: 'command', command, confirmLive: live })
      setNote(`已送出 ${label}（${r.id.slice(0, 14)}…），結果看「下行參數」`)
    } catch (e) {
      setNote((e as Error).message)
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Box>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">連線</h3>
          {!a ? (
            <p className="text-sm">Gateway 還沒有這個場館（{ov.activeSiteId}）。到「下行參數」按「立即推送計畫」會自動建立。</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">狀態</dt>
              <dd>{a.online ? pill(OK, '在線') : pill(BAD, '離線')}</dd>
              <dt className="text-muted-foreground">最後連線</dt>
              <dd>{tpe(a.lastSeenAt)}</dd>
              <dt className="text-muted-foreground">程式版本</dt>
              <dd className="font-mono">{a.agentVersion ?? '—'}</dd>
              <dt className="text-muted-foreground">計畫版本</dt>
              <dd>
                雲端 {a.planRev}・場館 {st?.planRev ?? '—'} {st && st.planRev !== a.planRev && pill(WARN, '尚未同步')}
              </dd>
              <dt className="text-muted-foreground">最後回報</dt>
              <dd>{tpe(st?.at)}</dd>
            </dl>
          )}
        </Box>
        <Box>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">硬體與門鎖</h3>
          {st ? (
            <div className="flex flex-wrap gap-2 text-sm">
              {pill(st.hardware?.modbus === 'OK' ? OK : BAD, `M-7045 ${st.hardware?.modbus ?? '—'}`)}
              {pill(st.hardware?.doorController === 'OK' ? OK : BAD, `門禁 ${st.hardware?.doorController ?? '—'}`)}
              {pill(st.hardware?.speaker === 'ERROR' ? BAD : OK, `廣播 ${st.hardware?.speaker ?? 'OK'}`)}
              {pill(st.door?.locked === false ? WARN : INFO, st.door?.locked === false ? '大門開啟中' : '大門上鎖')}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">尚未收到狀態回報</p>
          )}
        </Box>
        <Box>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">快速指令</h3>
          <div className="flex flex-wrap gap-2">
            {[
              [{ type: 'status.report' }, '要求回報狀態'],
              [{ type: 'plan.refresh' }, '重新下載計畫'],
              [{ type: 'door.unlock', door: 'main', seconds: 5, reason: '工程測試' }, '遠端開門 5 秒'],
              [{ type: 'audio.play', file: 'welcome.mp3' }, '廣播 welcome'],
            ].map(([c, l]) => (
              <button key={l as string} type="button" className="rounded border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => void quick(c as EdgeCommand, l as string)}>
                {l as string}
              </button>
            ))}
          </div>
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </Box>
      </div>
      <Connection q={q} post={post} />
      <Box>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">16 路 DO：場館讀回的實際狀態（不是平台的目標值）</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {(ov.plan?.circuits ?? []).map((c) => {
            const s = st?.circuits?.[c.no]
            const ovr = ov.plan?.overrides.find((o) => o.circuit === c.no)
            return (
              <div key={c.no} className={`rounded border p-2 text-xs ${s === 'ON' ? 'border-green-500 bg-green-50 dark:bg-green-950/40' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${s === 'ON' ? 'bg-green-500' : s === 'OFF' ? 'bg-gray-300' : 'bg-red-400'}`} />
                  <b>{c.no}</b>
                  <span className="text-muted-foreground">DO{String(c.channel).padStart(2, '0')}</span>
                </div>
                <div className="truncate" title={c.name}>
                  {c.name}
                </div>
                <div className="text-muted-foreground">
                  {KIND[c.kind] ?? c.kind}
                  {c.court ? ` ${c.court}` : ''}・{s ?? '未知'}
                </div>
                {ovr && <div className="text-amber-700">手動 {ovr.state}</div>}
              </div>
            )
          })}
        </div>
      </Box>
    </div>
  )
}

// ─────────────────────────── 浮動 IP 與心跳 ───────────────────────────

interface Conn {
  online: boolean
  lastSeenAt: string | null
  offlineAfterSec: number
  ip: string | null
  ipSince: string | null
  simulated: boolean
  ipHistory: { at: string; ip: string; prev: string | null; simulated: boolean }[]
  heartbeats: { at: string; ip: string; gapMs: number | null; skewMs: number; uptimeSec: number; planRev: number | null; pendingEvents: number; agentVersion: string }[]
}

/**
 * 場館在浮動 IP 後面：雲端不能主動連進去，只能把指令排進 Gateway，等場館下次連出來（長輪詢）時帶走。
 * 「從雲端呼叫場館」量的就是這段：排入 → 場館取走 → 場館回覆。
 */
function Connection({ q, post }: { q: (v: string, e?: string) => Promise<any>; post: (b: Record<string, unknown>) => Promise<any> }) {
  const [c, setC] = useState<Conn | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ping, setPing] = useState<string | null>(null)
  const qRef = useRef(q)
  qRef.current = q
  useEffect(() => {
    let alive = true
    const load = () =>
      qRef.current('connection')
        .then((r) => alive && (setC(r), setErr(null)))
        .catch((e) => alive && setErr((e as Error).message))
    void load()
    const t = setInterval(load, 3_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  async function callVenue() {
    setPing('排入指令…')
    try {
      const t0 = Date.now()
      const r = await post({ action: 'command', command: { type: 'status.report' } })
      for (let i = 0; i < 60; i++) {
        await new Promise((res) => setTimeout(res, 500))
        const x = await q('command', `&id=${encodeURIComponent(r.id)}`)
        if (x.status === 'ACKED' || ['FAILED', 'REJECTED', 'EXPIRED'].includes(x.status)) {
          const created = Date.parse(x.createdAt)
          const fmt = (iso: string | null) => (iso ? `${((Date.parse(iso) - created) / 1000).toFixed(2)} 秒` : '—')
          setPing(`${x.status === 'ACKED' ? '✔ 場館回應' : `✘ ${x.status}`}：排入 → 場館取走 ${fmt(x.deliveredAt)}・→ 場館回覆 ${fmt(x.ackedAt)}（總計 ${((Date.now() - t0) / 1000).toFixed(1)} 秒）`)
          return
        }
        setPing(`等待場館連出來取指令… ${((Date.now() - t0) / 1000).toFixed(0)} 秒（${x.status}）`)
      }
      setPing('30 秒內場館沒有取走指令（離線？）；指令仍排在 Gateway，恢復連線後會送達或過期')
    } catch (e) {
      setPing((e as Error).message)
    }
  }

  if (err) return <Box className="text-sm text-red-700">連線資訊讀取失敗：{err}</Box>
  if (!c) return <Box className="text-sm">讀取連線資訊…</Box>
  const beats = c.heartbeats.slice().reverse()
  const maxGap = Math.max(c.offlineAfterSec * 1000, ...beats.map((b) => b.gapMs ?? 0))
  const lastAgo = c.lastSeenAt ? Math.round((Date.now() - Date.parse(c.lastSeenAt)) / 1000) : null
  return (
    <Box>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">浮動 IP 與心跳（場館主動連出，雲端看到的來源）</h3>
        <button type="button" className="rounded bg-zinc-900 px-3 py-1 text-xs text-white" onClick={() => void callVenue()}>
          從雲端呼叫場館
        </button>
        {ping && <span className="text-xs">{ping}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">目前來源 IP</dt>
          <dd className="font-mono">
            {c.ip ?? '—'} {c.simulated && pill(INFO, '模擬浮動 IP')}
          </dd>
          <dt className="text-muted-foreground">使用此 IP 起</dt>
          <dd>{tpe(c.ipSince)}</dd>
          <dt className="text-muted-foreground">最後心跳</dt>
          <dd>
            {lastAgo === null ? '—' : `${lastAgo} 秒前`} {c.online ? pill(OK, '在線') : pill(BAD, `離線（超過 ${c.offlineAfterSec} 秒沒心跳）`)}
          </dd>
          <dt className="text-muted-foreground">IP 變更次數</dt>
          <dd>{Math.max(0, c.ipHistory.length - 1)}（最近 50 筆內）</dd>
        </dl>
        <div className="text-xs">
          <div className="mb-1 text-muted-foreground">IP 變更紀錄</div>
          <table className="w-full font-mono">
            <tbody>
              {c.ipHistory.slice(0, 8).map((h, i) => (
                <tr key={i} className="border-t">
                  <td className="py-0.5 pr-2">{tpe(h.at)}</td>
                  <td className="pr-2 font-semibold">{h.ip}</td>
                  <td className="text-muted-foreground">{h.prev ? `← ${h.prev}` : '第一次連線'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs">
          <div className="mb-1 text-muted-foreground">雲端收到的心跳間隔（紅＝超過離線門檻 {c.offlineAfterSec} 秒）</div>
          <div className="flex h-16 items-end gap-[2px]">
            {beats.slice(-60).map((b, i) => (
              <i
                key={i}
                title={`${tpe(b.at)}・間隔 ${b.gapMs === null ? '—' : (b.gapMs / 1000).toFixed(1) + ' 秒'}・IP ${b.ip}・時差 ${b.skewMs} ms・待送事件 ${b.pendingEvents}`}
                className={`block w-1.5 rounded-sm ${(b.gapMs ?? 0) > c.offlineAfterSec * 1000 ? 'bg-red-500' : (b.gapMs ?? 0) > 20_000 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ height: `${Math.max(6, ((b.gapMs ?? 0) / maxGap) * 64)}px` }}
              />
            ))}
          </div>
          {beats.at(-1) && (
            <div className="mt-1 text-muted-foreground">
              最後：{beats.at(-1)!.agentVersion}・開機 {Math.round(beats.at(-1)!.uptimeSec / 60)} 分・rev {beats.at(-1)!.planRev ?? '—'}・時差 {beats.at(-1)!.skewMs} ms
            </div>
          )}
        </div>
      </div>
    </Box>
  )
}

// ─────────────────────────── 下行參數 ───────────────────────────

function Downlink({ ov, q, post }: { ov: Overview | null; q: (v: string, e?: string) => Promise<any>; post: (b: Record<string, unknown>) => Promise<any> }) {
  const [cmds, setCmds] = useState<CommandRecord[]>([])
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [sel, setSel] = useState<CommandRecord | null>(null)
  useEffect(() => {
    const f = () => q('commands').then((r) => setCmds(r.commands)).catch(() => {})
    void f()
    const t = setInterval(f, 3_000)
    return () => clearInterval(t)
  }, [q])
  const plan = ov?.plan
  const from = plan ? Date.parse(plan.window.from) : 0
  const span = plan ? Date.parse(plan.window.to) - from : 1
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - from) / span) * 100))
  return (
    <div className="space-y-4">
      <Box>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">平台要推給場館的計畫（現在組出來的內容）</h3>
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={async () => {
              try {
                const r = await post({ action: 'push' })
                setPushMsg(r.skipped ? '略過（未設定）' : `已推送 rev ${r.rev}${r.changed ? '' : '（內容未變，版本不遞增）'}`)
              } catch (e) {
                setPushMsg((e as Error).message)
              }
            }}
          >
            立即推送計畫
          </button>
          {pushMsg && <span className="text-sm text-muted-foreground">{pushMsg}</span>}
          {ov?.active && <span className="ml-auto text-xs text-muted-foreground">Gateway 目前 rev {ov.active.planRev}・場館套用 rev {ov.active.status?.planRev ?? '—'}</span>}
        </div>
        {!plan ? (
          <p className="text-sm text-muted-foreground">組不出計畫：請確認場館代碼與迴路設定。</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Gateway 場館 ID <b className="font-mono">{plan.siteId}</b>・涵蓋 {tpe(plan.window.from, false)} – {tpe(plan.window.to, false)}・{plan.timeline.length} 段時段・密碼 {plan.doorCodes.length} 組・手動 {plan.overrides.length}・攝影機 {plan.cameras.length} 支
            </p>
            <div className="space-y-1">
              {plan.circuits.map((c) => (
                <div key={c.no} className="flex items-center gap-2 text-xs">
                  <div className="w-44 shrink-0 truncate font-mono">
                    {c.no} {c.name} <span className="text-muted-foreground">{KIND[c.kind]}</span>
                  </div>
                  <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-muted">
                    {c.kind === 'ALWAYS_ON' ? (
                      <i className="absolute inset-y-0 left-0 w-full bg-green-500/30" />
                    ) : (
                      plan.timeline
                        .filter((i) => i.circuit === c.no)
                        .map((i, k) => (
                          <i
                            key={k}
                            title={`${i.reason} ${tpe(i.start, false)}–${tpe(i.end, false)} ${i.ref ?? ''}`}
                            className={`absolute inset-y-0 ${i.reason === 'BOOKING' ? 'bg-green-500' : i.reason === 'BUSINESS_HOURS' ? 'bg-blue-500' : i.reason === 'NIGHT' ? 'bg-purple-500' : 'bg-amber-500'}`}
                            style={{ left: `${pct(Date.parse(i.start))}%`, width: `${pct(Date.parse(i.end)) - pct(Date.parse(i.start))}%` }}
                          />
                        ))
                    )}
                    <b className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: `${pct(Date.now())}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">綠＝預約、藍＝營業時間、紫＝夜間、橘＝活動／自訂；紅線＝現在。</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">門禁密碼（遮罩）與手動操作</summary>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-1">密碼</th>
                    <th className="p-1">時段</th>
                    <th className="p-1">可用時間</th>
                    <th className="p-1">id</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.doorCodes.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="p-1 font-mono">{d.code}</td>
                      <td className="p-1">{d.slotType}</td>
                      <td className="p-1">
                        {tpe(d.validFrom, false)} – {tpe(d.validTo, false)}
                      </td>
                      <td className="p-1 font-mono text-muted-foreground">{d.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(plan.overrides, null, 2)}</pre>
            </details>
          </>
        )}
      </Box>
      <div className="grid gap-4 lg:grid-cols-3">
        <Box className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">送給場館的指令（最近 80 筆）</h3>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1">時間</th>
                  <th className="p-1">指令</th>
                  <th className="p-1">來源</th>
                  <th className="p-1">狀態</th>
                  <th className="p-1">結果</th>
                </tr>
              </thead>
              <tbody>
                {cmds.map((c) => (
                  <tr key={c.id} className={`cursor-pointer border-t ${sel?.id === c.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`} onClick={() => setSel(c)}>
                    <td className="whitespace-nowrap p-1">{tpe(c.createdAt)}</td>
                    <td className="p-1 font-mono">{c.command.type}</td>
                    <td className="p-1">{c.requestedBy ?? '—'}</td>
                    <td className="p-1">{statusPill(c.status)}</td>
                    <td className="p-1 text-muted-foreground">{c.ack?.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
        <Box>
          <h3 className="mb-2 text-sm font-semibold">指令內容</h3>
          {sel ? <pre className="max-h-[480px] overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(sel, null, 2)}</pre> : <p className="text-sm text-muted-foreground">點左邊一筆查看完整參數與場館回報</p>}
        </Box>
      </div>
    </div>
  )
}

// ─────────────────────────── 流量 ───────────────────────────

function Traffic({ q }: { q: (v: string, e?: string) => Promise<any> }) {
  const [rows, setRows] = useState<TrafficEntry[]>([])
  const [dir, setDir] = useState<'all' | 'up' | 'down'>('all')
  const [quiet, setQuiet] = useState(true)
  useEffect(() => {
    const f = () => q('traffic', '&limit=300').then((r) => setRows(r.traffic)).catch(() => {})
    void f()
    const t = setInterval(f, 2_000)
    return () => clearInterval(t)
  }, [q])
  const shown = rows.filter((r) => (dir === 'all' || r.dir === dir) && !(quiet && r.status < 400 && (r.path === '/heartbeat' || (r.path.startsWith('/commands?') && r.note === '無指令'))))
  return (
    <Box>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <h3 className="font-semibold">Gateway 看到的場館請求（最近 300 筆，即時更新）</h3>
        <select className="rounded border bg-background px-2 py-1" value={dir} onChange={(e) => setDir(e.target.value as any)}>
          <option value="all">全部</option>
          <option value="up">上行 ↑（場館送上來）</option>
          <option value="down">下行 ↓（場館取走計畫與指令）</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
          隱藏心跳與空的長輪詢
        </label>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">時間</th>
              <th className="p-1" />
              <th className="p-1">請求</th>
              <th className="p-1">狀態</th>
              <th className="p-1">大小</th>
              <th className="p-1">耗時</th>
              <th className="p-1">內容摘要</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="whitespace-nowrap p-1">{tpe(r.at)}</td>
                <td className={`p-1 font-bold ${r.dir === 'up' ? 'text-purple-600' : 'text-cyan-600'}`}>{r.dir === 'up' ? '↑' : '↓'}</td>
                <td className="p-1 font-mono">
                  {r.method} {r.path}
                </td>
                <td className="p-1">{pill(r.status < 400 ? OK : BAD, String(r.status))}</td>
                <td className="p-1 text-muted-foreground">{r.bytes ? kb(r.bytes) : ''}</td>
                <td className="p-1 text-muted-foreground">{r.ms} ms</td>
                <td className="p-1">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  )
}

// ─────────────────────────── 錯誤 ───────────────────────────

function Errors({ q }: { q: (v: string, e?: string) => Promise<any> }) {
  const [d, setD] = useState<{ traffic: TrafficEntry[]; commands: CommandRecord[]; events: any[] } | null>(null)
  useEffect(() => {
    const f = () => q('errors').then(setD).catch(() => {})
    void f()
    const t = setInterval(f, 5_000)
    return () => clearInterval(t)
  }, [q])
  if (!d) return <Box>讀取中…</Box>
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Box>
        <h3 className="mb-2 text-sm font-semibold">Gateway 拒絕的請求（{d.traffic.length}）</h3>
        <ul className="max-h-[520px] space-y-1 overflow-auto text-xs">
          {d.traffic.map((r, i) => (
            <li key={i} className="border-t pt-1">
              {tpe(r.at)} {pill(BAD, String(r.status))} <span className="font-mono">{r.method} {r.path}</span>
              <div className="text-muted-foreground">{r.note}</div>
            </li>
          ))}
          {d.traffic.length === 0 && <li className="text-muted-foreground">沒有</li>}
        </ul>
      </Box>
      <Box>
        <h3 className="mb-2 text-sm font-semibold">失敗／拒絕／過期的指令（{d.commands.length}）</h3>
        <ul className="max-h-[520px] space-y-1 overflow-auto text-xs">
          {d.commands.map((c) => (
            <li key={c.id} className="border-t pt-1">
              {tpe(c.createdAt)} {statusPill(c.status)} <span className="font-mono">{c.command.type}</span>
              <div className="text-muted-foreground">{c.ack?.error ?? (c.status === 'EXPIRED' ? '場館在期限內沒有取走（離線）' : '')}</div>
            </li>
          ))}
          {d.commands.length === 0 && <li className="text-muted-foreground">沒有</li>}
        </ul>
      </Box>
      <Box>
        <h3 className="mb-2 text-sm font-semibold">平台收到的錯誤與警告事件（{d.events.length}）</h3>
        <ul className="max-h-[520px] space-y-1 overflow-auto text-xs">
          {d.events.map((e) => (
            <li key={e.id} className="border-t pt-1">
              {tpe(e.createdAt)} {pill(e.severity === 'ERROR' ? BAD : WARN, e.eventType)}
              <div>{e.title}</div>
              {e.description && <div className="text-muted-foreground">{e.description}</div>}
            </li>
          ))}
          {d.events.length === 0 && <li className="text-muted-foreground">沒有</li>}
        </ul>
      </Box>
    </div>
  )
}

// ─────────────────────────── 測試台 ───────────────────────────

type RunState = { status: 'idle' | 'running' | 'pass' | 'fail' | 'skip'; log: string[]; ms?: number }

function BenchPanel({ venueId, target }: { venueId: string; target: Target }) {
  const [state, setState] = useState<Record<string, RunState>>({})
  const [picked, setPicked] = useState<Set<string>>(() => new Set(SCENARIOS.map((s) => s.id)))
  const [running, setRunning] = useState(false)
  const stop = useRef(false)
  const groups = useMemo(() => [...new Set(SCENARIOS.map((s) => s.group))], [])

  const set = (id: string, patch: Partial<RunState>) => setState((s) => ({ ...s, [id]: { ...(s[id] ?? { status: 'idle', log: [] }), ...patch } }))
  const append = (id: string, line: string) => setState((s) => ({ ...s, [id]: { ...(s[id] ?? { status: 'running', log: [] }), log: [...(s[id]?.log ?? []), line] } }))

  async function runOne(sc: Scenario, confirmLive: boolean) {
    if (sc.simOnly && target !== 'SIMULATOR') {
      set(sc.id, { status: 'skip', log: ['只限網頁模擬器（需要在地端製造故障）'] })
      return
    }
    set(sc.id, { status: 'running', log: [], ms: undefined })
    const t0 = Date.now()
    const bench = new Bench({ venue: venueId, target, confirmLive, log: (m) => append(sc.id, m) })
    try {
      const r = await sc.run(bench)
      set(sc.id, { status: r === 'skip' ? 'skip' : 'pass', ms: Date.now() - t0 })
      if (r === 'skip') append(sc.id, '略過：計畫裡沒有適用的迴路')
    } catch (e) {
      append(sc.id, `✗ ${(e as Error).message}`)
      set(sc.id, { status: 'fail', ms: Date.now() - t0 })
    }
    if (target === 'SIMULATOR' && sc.simOnly) await new Bench({ venue: venueId, target, confirmLive: false, log: () => {} }).inject('reset').catch(() => {})
  }

  async function run(list: Scenario[]) {
    const touches = list.some((s) => s.touchesLive)
    let confirmLive = false
    if (target === 'LIVE' && touches) {
      confirmLive = confirm('目前連的是「實體 IoT PC」。部分情境會開關燈、開門、廣播，確定要對現場執行？')
      if (!confirmLive) list = list.filter((s) => !s.touchesLive)
    }
    stop.current = false
    setRunning(true)
    for (const sc of list) {
      if (stop.current) break
      await runOne(sc, confirmLive)
    }
    setRunning(false)
  }

  const total = Object.values(state)
  const count = (s: RunState['status']) => total.filter((x) => x.status === s).length
  return (
    <Box>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold">測試台：{SCENARIOS.length} 個情境（目前對象：{target === 'LIVE' ? '實體 IoT PC' : '網頁模擬器'}）</h3>
        <button type="button" disabled={running} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void run(SCENARIOS.filter((s) => picked.has(s.id)))}>
          執行勾選的 {picked.size} 個
        </button>
        {running && (
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => (stop.current = true)}>
            跑完這個就停
          </button>
        )}
        <span className="text-sm">
          {pill(OK, `通過 ${count('pass')}`)} {pill(BAD, `失敗 ${count('fail')}`)} {pill(WARN, `略過 ${count('skip')}`)}
        </span>
        <button type="button" className="ml-auto text-xs underline" onClick={() => setPicked(new Set(picked.size === SCENARIOS.length ? [] : SCENARIOS.map((s) => s.id)))}>
          {picked.size === SCENARIOS.length ? '全部取消' : '全選'}
        </button>
      </div>
      {groups.map((g) => (
        <div key={g} className="mb-4">
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{g}</h4>
          <div className="space-y-1">
            {SCENARIOS.filter((s) => s.group === g).map((s) => {
              const st = state[s.id]
              return (
                <details key={s.id} className="rounded border px-2 py-1" open={st?.status === 'fail' || st?.status === 'running'}>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.has(s.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setPicked((p) => (e.target.checked ? new Set([...p, s.id]) : new Set([...p].filter((x) => x !== s.id))))}
                    />
                    <span className="w-14">
                      {!st || st.status === 'idle'
                        ? pill('bg-muted text-muted-foreground', '未執行')
                        : st.status === 'running'
                          ? pill(INFO, '執行中')
                          : st.status === 'pass'
                            ? pill(OK, '通過')
                            : st.status === 'skip'
                              ? pill(WARN, '略過')
                              : pill(BAD, '失敗')}
                    </span>
                    <span className="flex-1">{s.title}</span>
                    {s.simOnly && pill(INFO, '模擬器')}
                    {s.touchesLive && pill(WARN, '動現場')}
                    {st?.ms !== undefined && <span className="text-xs text-muted-foreground">{(st.ms / 1000).toFixed(1)}s</span>}
                    <button type="button" disabled={running} className="rounded border px-2 py-0.5 text-xs" onClick={(e) => (e.preventDefault(), void run([s]))}>
                      執行
                    </button>
                  </summary>
                  {st?.log.length ? <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{st.log.join('\n')}</pre> : null}
                </details>
              )
            })}
          </div>
        </div>
      ))}
    </Box>
  )
}

// ─────────────────────────── 攝影機 ───────────────────────────

function Cameras({ ov, q, post }: { ov: Overview | null; q: (v: string, e?: string) => Promise<any>; post: (b: Record<string, unknown>) => Promise<any> }) {
  const [sessions, setSessions] = useState<MediaSessionInfo[]>([])
  const [playing, setPlaying] = useState<{ session: string; live: boolean; title: string } | null>(null)
  const site = ov?.activeSiteId
  useEffect(() => {
    const f = () => q('media').then((r) => setSessions(r.sessions)).catch(() => {})
    void f()
    const t = setInterval(f, 3_000)
    return () => clearInterval(t)
  }, [q])
  const cams = ov?.plan?.cameras ?? []
  return (
    <div className="space-y-4">
      <Box>
        <p className="mb-2 text-sm text-muted-foreground">即時影像與錄影調閱也在「即時監控 → 攝影機」頁；這裡另外列出 Gateway 上的每個串流 session，方便除錯。</p>
        {playing && site && (
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <b>{playing.title}</b>
              <button type="button" className="text-xs underline" onClick={() => setPlaying(null)}>
                關閉
              </button>
            </div>
            <HlsPlayer src={`/api/admin/engineer/media/${site}/${playing.session}/index.m3u8`} live={playing.live} className="aspect-video w-full max-w-3xl rounded" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {cams.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
              onClick={async () => {
                const session = `live-${crypto.randomUUID()}`
                await post({ action: 'command', command: { type: 'camera.live', camera: c.id, session, seconds: 120 } })
                setPlaying({ session, live: true, title: `CAM${c.id} ${c.name}（即時）` })
              }}
            >
              ▶ CAM{c.id} {c.name}
            </button>
          ))}
        </div>
      </Box>
      <Box>
        <h3 className="mb-2 text-sm font-semibold">Gateway 上的影像 session</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">建立</th>
              <th className="p-1">攝影機</th>
              <th className="p-1">類型</th>
              <th className="p-1">片段</th>
              <th className="p-1">大小</th>
              <th className="p-1">狀態</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.session} className="border-t">
                <td className="p-1">{tpe(s.createdAt)}</td>
                <td className="p-1">CAM{s.camera}</td>
                <td className="p-1">{s.kind === 'live' ? '即時' : `錄影 ${tpe(s.from, false)}–${tpe(s.to, false).slice(-5)}`}</td>
                <td className="p-1">{s.segments}</td>
                <td className="p-1">{kb(s.bytes)}</td>
                <td className="p-1">{s.ended ? pill('bg-muted text-muted-foreground', s.endReason ?? '結束') : pill(OK, '進行中')}</td>
                <td className="p-1">
                  {s.segments > 0 && (
                    <button type="button" className="underline" onClick={() => setPlaying({ session: s.session, live: s.kind === 'live' && !s.ended, title: `CAM${s.camera} ${s.kind === 'live' ? '即時' : '錄影'}` })}>
                      播放
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </div>
  )
}
