'use client'

/**
 * 場館電腦（地端）原始 log 調閱：送出 log.upload 指令 → 場館上傳 → 在這裡檢視或下載。
 * 內容保存在 IoT Gateway（DigitalOcean），30 天後自動刪除。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LogFile, LogLevel, LogUploadSummary } from '@gh/iot-contract'

interface Site {
  siteCode: string
  name: string
}

const FILES: { id: LogFile; label: string; hint: string }[] = [
  { id: 'edge', label: 'edge.log', hint: '程式運作、連線、計畫、指令' },
  { id: 'audit', label: 'audit.log', hint: '開門、手動操作、迴路切換' },
  { id: 'modbus', label: 'modbus.log', hint: '每次繼電器讀寫' },
]

const RANGES = [
  { label: '最近 1 小時', hours: 1 },
  { label: '最近 6 小時', hours: 6 },
  { label: '最近 24 小時', hours: 24 },
  { label: '最近 3 天', hours: 72 },
]

const STATUS: Record<string, { label: string; cls: string; pending?: boolean }> = {
  QUEUED: { label: '等待場館連線', cls: 'bg-amber-100 text-amber-800', pending: true },
  DELIVERED: { label: '場館處理中', cls: 'bg-blue-100 text-blue-800', pending: true },
  ACKED: { label: '已上傳', cls: 'bg-green-100 text-green-800' },
  FAILED: { label: '上傳失敗', cls: 'bg-red-100 text-red-800' },
  REJECTED: { label: '場館拒絕', cls: 'bg-red-100 text-red-800' },
  EXPIRED: { label: '場館離線，已過期', cls: 'bg-gray-200 text-gray-700' },
}

const LEVEL_CLS: Record<string, string> = { DEBUG: 'text-gray-500', INFO: 'text-foreground', WARN: 'text-amber-700', ERROR: 'text-red-700 font-semibold' }

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
const size = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

interface Line {
  ts?: string
  level?: string
  component?: string
  msg?: string
  [k: string]: unknown
}

export function EdgeLogsPanel({ sites, configured }: { sites: Site[]; configured: boolean }) {
  const [site, setSite] = useState(sites[0]?.siteCode ?? '')
  const [files, setFiles] = useState<LogFile[]>(['edge', 'audit'])
  const [hours, setHours] = useState(1)
  const [minLevel, setMinLevel] = useState<LogLevel | ''>('')
  const [rows, setRows] = useState<LogUploadSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<{ id: string; file: LogFile; lines: Line[]; raw: number } | null>(null)
  const [viewLevel, setViewLevel] = useState<LogLevel | ''>('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (!site) return
    const res = await fetch(`/api/admin/iot/logs?site=${encodeURIComponent(site)}`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    if (!res.ok) return setError(json?.error ?? '讀取失敗')
    setError(null)
    setRows(json.logs ?? [])
  }, [site])

  useEffect(() => {
    if (configured) void load()
  }, [configured, load])

  // 有尚未完成的調閱時每 3 秒更新
  const pending = rows.some((r) => STATUS[r.status]?.pending)
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => void load(), 3_000)
    return () => clearInterval(t)
  }, [pending, load])

  async function request() {
    setBusy(true)
    setError(null)
    const to = new Date()
    const from = new Date(to.getTime() - hours * 3600_000)
    const res = await fetch('/api/admin/iot/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ site, files, from: from.toISOString(), to: to.toISOString(), minLevel: minLevel || undefined }),
    })
    const json = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(json?.error ?? '送出失敗')
    await load()
  }

  async function open(id: string, file: LogFile) {
    setError(null)
    const res = await fetch(`/api/admin/iot/logs/${id}?site=${encodeURIComponent(site)}&file=${file}`, { cache: 'no-store' })
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? '讀取失敗')
    const text = await res.text()
    const lines = text
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Line
        } catch {
          return { msg: l } as Line
        }
      })
    setView({ id, file, lines, raw: lines.length })
  }

  const shown = useMemo(() => {
    if (!view) return []
    const rank = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    const min = viewLevel ? rank.indexOf(viewLevel) : 0
    const needle = q.trim().toLowerCase()
    return view.lines
      .filter((l) => rank.indexOf(String(l.level ?? 'INFO')) >= min)
      .filter((l) => !needle || JSON.stringify(l).toLowerCase().includes(needle))
      .slice(-2000)
  }, [view, viewLevel, q])

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4 mb-6">
      <div>
        <h3 className="font-semibold">場館電腦原始 log</h3>
        <p className="text-sm text-muted-foreground">
          向場館電腦調閱本機 log 檔，場館連線時約數秒內上傳。檔案保存在 IoT Gateway，30 天後自動刪除。單次最多 5 MB，超過時只保留最新的部分。
        </p>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">尚未設定 IoT Gateway（IOT_GATEWAY_URL），無法調閱。</p>
      ) : sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">還沒有場館設定場館代碼（siteCode），場館電腦接上後才能調閱。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="text-sm font-medium space-y-1">
              <span>場館</span>
              <select className="w-full border rounded px-2 py-1.5 bg-background" value={site} onChange={(e) => setSite(e.target.value)}>
                {sites.map((s) => (
                  <option key={s.siteCode} value={s.siteCode}>
                    {s.name}（{s.siteCode}）
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="text-sm space-y-1">
              <legend className="font-medium">檔案</legend>
              {FILES.map((f) => (
                <label key={f.id} className="flex items-center gap-2" title={f.hint}>
                  <input
                    type="checkbox"
                    checked={files.includes(f.id)}
                    onChange={(e) => setFiles(e.target.checked ? [...files, f.id] : files.filter((x) => x !== f.id))}
                  />
                  <span className="font-mono">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.hint}</span>
                </label>
              ))}
            </fieldset>
            <label className="text-sm font-medium space-y-1">
              <span>時間範圍</span>
              <select className="w-full border rounded px-2 py-1.5 bg-background" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {RANGES.map((r) => (
                  <option key={r.hours} value={r.hours}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium space-y-1">
              <span>最低等級</span>
              <select className="w-full border rounded px-2 py-1.5 bg-background" value={minLevel} onChange={(e) => setMinLevel(e.target.value as LogLevel | '')}>
                <option value="">全部（含 DEBUG）</option>
                <option value="INFO">INFO 以上</option>
                <option value="WARN">WARN 以上</option>
                <option value="ERROR">只看 ERROR</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
              disabled={busy || files.length === 0 || !site}
              onClick={() => void request()}
            >
              {busy ? '送出中…' : '向場館調閱'}
            </button>
            <button type="button" className="px-3 py-2 rounded border text-sm" onClick={() => void load()}>
              重新整理
            </button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-2 py-2">調閱時間</th>
                  <th className="px-2 py-2">範圍</th>
                  <th className="px-2 py-2">申請人</th>
                  <th className="px-2 py-2">狀態</th>
                  <th className="px-2 py-2">檔案</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                      還沒有調閱紀錄
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100' }
                  return (
                    <tr key={r.id} className="border-b align-top">
                      <td className="px-2 py-2 whitespace-nowrap">{fmt(r.createdAt)}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {fmt(r.from)}
                        <br />～ {fmt(r.to)}
                        {r.minLevel && <div className="text-muted-foreground">{r.minLevel} 以上</div>}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.requestedBy?.replace(/^admin:/, '') ?? '—'}</td>
                      <td className="px-2 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${st.cls}`}>{st.label}</span>
                        {r.error && <div className="text-xs text-red-700 mt-1">{r.error}</div>}
                      </td>
                      <td className="px-2 py-2 space-y-1">
                        {r.upload
                          ? r.upload.files.map((f) => (
                              <div key={f.name} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono">{f.name}.log</span>
                                <span className="text-muted-foreground">
                                  {f.lines.toLocaleString()} 行・{size(f.bytes)}
                                  {f.truncated && '・已截斷（只留最新）'}
                                </span>
                                {f.lines > 0 && (
                                  <>
                                    <button type="button" className="underline" onClick={() => void open(r.id, f.name)}>
                                      檢視
                                    </button>
                                    <a className="underline" href={`/api/admin/iot/logs/${r.id}?site=${encodeURIComponent(site)}&file=${f.name}&download=1`}>
                                      下載
                                    </a>
                                  </>
                                )}
                              </div>
                            ))
                          : r.files.map((f) => (
                              <div key={f} className="font-mono text-xs text-muted-foreground">
                                {f}.log
                              </div>
                            ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {view && (
            <div className="border rounded p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold font-mono">{view.file}.log</span>
                <span className="text-muted-foreground">
                  顯示 {shown.length.toLocaleString()} / {view.raw.toLocaleString()} 行（最多顯示最後 2,000 行，完整內容請下載）
                </span>
                <select className="border rounded px-2 py-1 bg-background" value={viewLevel} onChange={(e) => setViewLevel(e.target.value as LogLevel | '')}>
                  <option value="">全部等級</option>
                  <option value="INFO">INFO 以上</option>
                  <option value="WARN">WARN 以上</option>
                  <option value="ERROR">ERROR</option>
                </select>
                <input className="border rounded px-2 py-1 bg-background" placeholder="搜尋（例：commandId、迴路 03）" value={q} onChange={(e) => setQ(e.target.value)} />
                <button type="button" className="ml-auto underline" onClick={() => setView(null)}>
                  關閉
                </button>
              </div>
              <div className="max-h-[480px] overflow-auto font-mono text-xs">
                <table className="w-full">
                  <tbody>
                    {shown.map((l, i) => {
                      const { ts, level, component, msg, siteId: _s, ...rest } = l
                      return (
                        <tr key={i} className={`border-b ${LEVEL_CLS[String(level)] ?? ''}`}>
                          <td className="px-1 py-0.5 whitespace-nowrap">{ts ? fmt(String(ts)) : ''}</td>
                          <td className="px-1 py-0.5">{level}</td>
                          <td className="px-1 py-0.5">{component}</td>
                          <td className="px-1 py-0.5">{msg}</td>
                          <td className="px-1 py-0.5 text-muted-foreground break-all">{Object.keys(rest).length ? JSON.stringify(rest) : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
