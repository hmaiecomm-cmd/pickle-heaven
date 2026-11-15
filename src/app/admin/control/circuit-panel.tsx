'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { circuitPreviewAction, circuitSendAction } from '@/server/admin-ops-actions'

export interface CircuitRow {
  number: string
  name: string
  categoryLabel: string
  range: string
  location: string
  state: 'ON' | 'OFF' | null
  /** 不可由系統開關的原因（24 小時供電、預留等）；null 表示可操作 */
  locked: string | null
}

type Preview = Awaited<ReturnType<typeof circuitPreviewAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never

/** 18 路電力迴路的人工操作。送出前一律預覽並填寫原因；24 小時供電與預留迴路不提供按鈕。 */
export function CircuitPanel({ circuits, canControl, connected, hasData }: { circuits: CircuitRow[]; canControl: boolean; connected: boolean; hasData: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const keyRef = React.useRef('')

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
      setPreview(res.data)
    } finally {
      setBusy(false)
    }
  }
  const send = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await circuitSendAction({ circuitNumber: preview.circuit.number, targetState: preview.targetState, reason, idempotencyKey: keyRef.current })
      if (!res.ok) return toast(res.error, 'error')
      toast(`迴路 ${preview.circuit.number} 已${preview.actionLabel}${res.data.simulated ? '（模擬）' : ''}`, 'success')
      setPreview(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const disabledReason = !canControl ? '目前帳號沒有設備控制權限' : !connected ? '設備尚未串接' : !hasData ? '迴路資料尚未建立' : null

  return (
    <section aria-labelledby="circuit-title" className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <h2 id="circuit-title" className="text-sm font-semibold">18 路電力迴路</h2>
        {disabledReason && <p className="text-xs text-muted">{disabledReason}，只能檢視</p>}
      </div>
      {groups.map((g) => (
        <div key={g.label} className="border-b border-zinc-100 last:border-b-0">
          <p className="bg-zinc-50/70 px-4 py-1.5 text-[11px] font-semibold text-zinc-600">{g.label}</p>
          <ul className="divide-y divide-zinc-100">
            {g.items.map((c) => (
              <li key={c.number} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0 text-sm">
                  <span className="mr-2 font-mono text-xs text-zinc-500">{c.number}</span>
                  {c.name}
                  <span className="ml-1 text-xs text-muted">{c.location}</span>
                </span>
                {c.locked ? (
                  <span className="text-xs text-violet-700">{c.locked}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{c.state === 'ON' ? '開啟中' : c.state === 'OFF' ? '已關閉' : '狀態未知'}</span>
                    {(['ON', 'OFF'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!!disabledReason || busy}
                        title={disabledReason ?? undefined}
                        onClick={() => open(c.number, t)}
                        className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t === 'ON' ? '開啟' : '關閉'}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

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
