'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { circuitPreviewAction, circuitResumeAction, circuitSendAction } from '@/server/admin-ops-actions'

export interface CircuitRow {
  number: string
  name: string
  categoryLabel: string
  range: string
  location: string
  state: 'ON' | 'OFF' | null
  /** 排程算出的預期狀態（未串接設備時只有這個） */
  expected: 'ON' | 'OFF' | null
  /** 手動維持中 */
  override: { mode: string; until: string | null } | null
  /** 不可由系統開關的原因（24 小時供電、預留等）；null 表示可操作 */
  locked: string | null
}

const HOLD_MINUTES = [15, 30, 60, 120, 240, 480]
const fmtTime = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const overrideLabel = (o: { mode: string; until: string | null }) =>
  o.mode === 'INDEFINITE' ? '手動・一直維持' : o.mode === 'MINUTES' && o.until ? `手動・維持至 ${fmtTime(o.until)}` : '手動・維持到下一個排程時間點'
const stateText = (c: CircuitRow) =>
  c.state ? (c.state === 'ON' ? '開啟中' : '已關閉') : c.expected ? `排程預期：${c.expected === 'ON' ? '開啟' : '關閉'}` : '狀態未知'

type Preview = Awaited<ReturnType<typeof circuitPreviewAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never

/** 18 路電力迴路的人工操作。送出前一律預覽並填寫原因；24 小時供電與預留迴路不提供按鈕。 */
export function CircuitPanel({ circuits, canControl, connected, hasData }: { circuits: CircuitRow[]; canControl: boolean; connected: boolean; hasData: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [reason, setReason] = React.useState('')
  const [holdMode, setHoldMode] = React.useState<'NEXT_CHANGE' | 'MINUTES' | 'INDEFINITE'>('NEXT_CHANGE')
  const [holdMinutes, setHoldMinutes] = React.useState(60)
  const [busy, setBusy] = React.useState(false)
  const [expandedCircuit, setExpandedCircuit] = React.useState<string | null>(null)
  const [settingsState, setSettingsState] = React.useState<Record<string, {
    controlMode: 'reservation' | 'business' | 'night' | '24h' | 'off'
    selectedCircuit: string
  }>>({})
  const keyRef = React.useRef('')

  // 控制模式配置
  const CONTROL_MODES = [
    { id: 'reservation' as const, label: '預約動態控制', desc: '依線上預約自動開啟與關閉' },
    { id: 'business' as const, label: '營業時間控制', desc: '營業時間內開啟' },
    { id: 'night' as const, label: '夜間環境控制', desc: '夜間環境控制' },
    { id: '24h' as const, label: '24 小時開啟', desc: '設備持續保持開啟' },
    { id: 'off' as const, label: '關閉', desc: '設備維持關閉狀態' },
  ]

  const groups = circuits.reduce<{ label: string; items: CircuitRow[] }[]>((acc, c) => {
    const label = `${c.range} ${c.categoryLabel}`
    const g = acc.find((x) => x.label === label)
    if (g) g.items.push(c)
    else acc.push({ label, items: [c] })
    return acc
  }, [])

  const open = async (n: string, target: 'ON' | 'OFF') => {
    setBusy(true)
    try {
      const res = await circuitPreviewAction(n, target)
      if (!res.ok) return toast(res.error, 'error')
      keyRef.current = `cir-${crypto.randomUUID()}`
      setReason('')
      setHoldMode('NEXT_CHANGE')
      setPreview(res.data)
    } finally {
      setBusy(false)
    }
  }
  const send = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await circuitSendAction({
        circuitNumber: preview.circuit.number,
        targetState: preview.targetState,
        reason,
        idempotencyKey: keyRef.current,
        hold: holdMode === 'MINUTES' ? { mode: holdMode, minutes: holdMinutes } : { mode: holdMode },
      })
      if (!res.ok) return toast(res.error, 'error')
      toast(`迴路 ${preview.circuit.number} 已${preview.actionLabel}${res.data.simulated ? '（模擬）' : ''}`, 'success')
      setPreview(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const resume = async (n: string) => {
    setBusy(true)
    try {
      const res = await circuitResumeAction(n)
      if (!res.ok) return toast(res.error, 'error')
      toast(`迴路 ${n} 已恢復排程，下一分鐘依排程更新`, 'success')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const disabledReason = !canControl ? '目前帳號沒有設備控制權限' : !connected ? '設備尚未串接' : !hasData ? '迴路資料尚未建立' : null

  return (
    <section aria-labelledby="circuit-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="circuit-title" className="text-sm font-semibold">18 路電力迴路</h2>
        {disabledReason && <p className="text-xs text-muted">{disabledReason}，只能檢視</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {circuits.map((c) => (
          <div
            key={c.number}
            className="rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-300 transition-colors"
          >
            {/* 卡片頭部：基本信息 */}
            <div className="p-4 space-y-3 border-b border-zinc-100">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-zinc-500 font-bold">{c.number}</span>
                    <h3 className="font-medium text-sm truncate">{c.name}</h3>
                  </div>
                  <p className="text-xs text-muted mt-1">{c.location}</p>
                </div>
                {c.state ? (
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                    c.state === 'ON' ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'
                  }`}>
                    {c.state === 'ON' ? '開啟中' : '已關閉'}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-xs font-medium bg-zinc-50 text-zinc-600 whitespace-nowrap">
                    {c.expected ? `預期：${c.expected === 'ON' ? '開' : '關'}` : '未知'}
                  </span>
                )}
              </div>

              {/* 迴路信息網格 */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <p className="text-muted">分類</p>
                  <p className="font-medium">{c.categoryLabel}</p>
                </div>
                <div>
                  <p className="text-muted">範圍</p>
                  <p className="font-medium">{c.range}</p>
                </div>
              </div>

              {/* 覆蓋狀態 */}
              {c.override && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
                  {overrideLabel(c.override)}
                </div>
              )}
            </div>

            {/* 卡片底部：操作按鈕 */}
            <div className="p-4 space-y-3">
              {c.locked ? (
                <p className="text-xs text-violet-700 text-center py-2">{c.locked}</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {(['ON', 'OFF'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!!disabledReason || busy}
                        title={disabledReason ?? undefined}
                        onClick={() => open(c.number, t)}
                        className="flex-1 h-9 rounded-lg border border-zinc-300 bg-white text-sm font-medium hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t === 'ON' ? '開啟' : '關閉'}
                      </button>
                    ))}
                  </div>
                  {c.override && canControl && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resume(c.number)}
                      className="w-full h-9 rounded-lg text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40 transition-colors"
                    >
                      恢復排程
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedCircuit(expandedCircuit === c.number ? null : c.number)}
                    className="w-full h-9 rounded-lg border border-zinc-200 bg-white text-xs font-medium hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>修改設定</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${expandedCircuit === c.number ? 'rotate-180' : ''}`} />
                  </button>

                  {/* 展開設定區 */}
                  {expandedCircuit === c.number && (
                    <div className="pt-3 border-t border-zinc-100 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">控制回路</label>
                        <select
                          value={settingsState[c.number]?.selectedCircuit ?? c.number}
                          onChange={(e) => setSettingsState(prev => ({
                            ...prev,
                            [c.number]: { ...prev[c.number] || { controlMode: 'reservation' }, selectedCircuit: e.target.value }
                          }))}
                          className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-sm"
                        >
                          {['01', '02', '03', '04', '05'].map(n => (
                            <option key={n} value={n}>{n}｜球場 {String.fromCharCode(64 + parseInt(n))} {n > '02' ? '壁燈' : '主燈'}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">控制模式</label>
                        <select
                          value={settingsState[c.number]?.controlMode ?? 'reservation'}
                          onChange={(e) => setSettingsState(prev => ({
                            ...prev,
                            [c.number]: { ...prev[c.number] || { selectedCircuit: c.number }, controlMode: e.target.value as any }
                          }))}
                          className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-sm"
                        >
                          {CONTROL_MODES.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-zinc-500 mt-1">
                          {CONTROL_MODES.find(m => m.id === (settingsState[c.number]?.controlMode ?? 'reservation'))?.desc}
                        </p>
                      </div>

                      {/* 模式別設定欄位 */}
                      {(() => {
                        const mode = settingsState[c.number]?.controlMode ?? 'reservation'
                        switch (mode) {
                          case 'reservation':
                            return (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">預約前提前開啟（分鐘）</label>
                                  <input type="number" min="0" max="120" defaultValue="15" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">預約後延遲關閉（分鐘）</label>
                                  <input type="number" min="0" max="120" defaultValue="15" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                              </div>
                            )
                          case 'business':
                            return (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">營業開始時間</label>
                                  <input type="time" defaultValue="09:00" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">營業結束時間</label>
                                  <input type="time" defaultValue="22:00" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                              </div>
                            )
                          case 'night':
                            return (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">夜間開始時間</label>
                                  <input type="time" defaultValue="22:00" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">夜間結束時間</label>
                                  <input type="time" defaultValue="06:00" className="w-full h-8 rounded-lg border border-zinc-300 px-3 text-xs" />
                                </div>
                              </div>
                            )
                          case '24h':
                            return <p className="text-xs text-zinc-600 py-2">設備持續保持開啟，不使用時間限制。</p>
                          case 'off':
                            return <p className="text-xs text-zinc-600 py-2">設備維持關閉狀態，不執行自動開啟。</p>
                          default:
                            return null
                        }
                      })()}

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedCircuit(null)}
                          className="flex-1 h-9 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
                        >
                          儲存設定
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsState(prev => {
                              const newState = { ...prev }
                              delete newState[c.number]
                              return newState
                            })
                            setExpandedCircuit(null)
                          }}
                          className="flex-1 h-9 rounded-lg border border-zinc-300 text-xs font-medium hover:bg-zinc-50"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={preview !== null} onOpenChange={(o) => !o && !busy && setPreview(null)}>
        <SheetContent title="迴路操作預覽" description="確認後才會送出，這次確認只適用這一個操作">
          {preview && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1">
                <dt className="text-muted">迴路</dt>
                <dd>{preview.circuit.number}・{preview.circuit.name}</dd>
                <dt className="text-muted">分類</dt>
                <dd>{preview.circuit.category}</dd>
                <dt className="text-muted">位置</dt>
                <dd>{preview.circuit.location}</dd>
                <dt className="text-muted">執行內容</dt>
                <dd className="font-semibold">{preview.actionLabel}</dd>
              </dl>
              {preview.simulated && <Pill tone="violet">展示環境：只會產生模擬結果</Pill>}
              {preview.warnings.map((w) => (
                <p key={w} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">{w}</p>
              ))}
              {preview.blockers.map((b) => (
                <p key={b} className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-800">無法執行：{b}</p>
              ))}
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">維持方式</legend>
                {(
                  [
                    ['NEXT_CHANGE', '維持到下一個排程時間點（例如營業結束或預約開始）'],
                    ['MINUTES', '維持指定時間'],
                    ['INDEFINITE', '一直維持，直到按「恢復排程」'],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="radio" name="cir-hold" value={v} checked={holdMode === v} onChange={() => setHoldMode(v)} />
                    {label}
                    {v === 'MINUTES' && holdMode === 'MINUTES' && (
                      <select aria-label="維持分鐘數" value={holdMinutes} onChange={(e) => setHoldMinutes(Number(e.target.value))} className="h-8 rounded-lg border border-zinc-300 px-2 text-sm">
                        {HOLD_MINUTES.map((m) => (
                          <option key={m} value={m}>
                            {m >= 60 ? `${m / 60} 小時` : `${m} 分鐘`}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                ))}
              </fieldset>
              <Field label="原因（必填，記錄於操作紀錄）" htmlFor="cir-reason">
                <Input id="cir-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="例：活動延長，需延後關燈" />
              </Field>
              <div className="flex gap-2">
                <button type="button" disabled={busy || preview.blockers.length > 0 || !reason.trim()} onClick={send} className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
                  {busy ? '送出中…' : `確認${preview.actionLabel}`}
                </button>
                <button type="button" onClick={() => setPreview(null)} className="h-11 rounded-xl border border-zinc-300 px-4">取消</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
