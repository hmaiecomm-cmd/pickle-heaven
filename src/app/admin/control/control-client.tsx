'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { deviceCommandStatusAction, devicePreviewAction, deviceSendAction } from '@/server/admin-ops-actions'

type State = 'NOT_CONNECTED' | 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
interface Court {
  id: string
  name: string
  usage: string | null
  devices: { id: string; name: string; typeLabel: string; state: State; lastAction: string | null; actions: { action: string; label: string }[] }[]
}
interface Cmd {
  id: string
  label: string
  status: string
  simulated: boolean
  error: string | null
  at: string
  by: string
}
type Preview = Awaited<ReturnType<typeof devicePreviewAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never

const STATUS: Record<string, { label: string; tone: 'gray' | 'blue' | 'green' | 'red' | 'amber' }> = {
  SENT: { label: '已送出，等待設備回報', tone: 'blue' },
  ACKED: { label: '設備已確認', tone: 'green' },
  FAILED: { label: '失敗', tone: 'red' },
  TIMEOUT: { label: '逾時', tone: 'amber' },
}
const STATE_LABEL: Record<State, string> = { NOT_CONNECTED: '尚未串接', ONLINE: '在線', OFFLINE: '離線', UNKNOWN: '狀態未知' }

export function ControlClient({
  integration,
  canControl,
  courts,
  commands,
}: {
  integration: { mode: string; label: string; reason: string }
  canControl: boolean
  courts: Court[]
  commands: Cmd[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [tracking, setTracking] = React.useState<{ id: string; status: string; error: string | null; simulated: boolean } | null>(null)
  const keyRef = React.useRef('')

  const open = async (deviceId: string, action: string) => {
    setBusy(true)
    try {
      const res = await devicePreviewAction(deviceId, action)
      if (!res.ok) return toast(res.error, 'error')
      keyRef.current = `dev-${crypto.randomUUID()}`
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
      const res = await deviceSendAction({ deviceId: preview.device.id, action: preview.action, idempotencyKey: keyRef.current, reason })
      if (!res.ok) return toast(res.error, 'error')
      setTracking({ id: res.data.id, status: res.data.status, error: null, simulated: res.data.simulated })
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  // 追蹤指令結果：送出後輪詢，直到設備回報、失敗或逾時
  React.useEffect(() => {
    if (!tracking || tracking.status !== 'SENT') return
    const t = setTimeout(async () => {
      const res = await deviceCommandStatusAction(tracking.id)
      if (res.ok) {
        setTracking({ ...tracking, status: res.data.status, error: res.data.error })
        if (res.data.status !== 'SENT') router.refresh()
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [tracking, router])

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-3 text-sm ${integration.mode === 'NOT_CONNECTED' ? 'bg-zinc-100 text-zinc-700' : 'bg-violet-50 text-violet-900'}`}>
        <p className="font-semibold">設備串接：{integration.label}</p>
        <p className="mt-0.5 text-xs">{integration.reason}</p>
        {!canControl && <p className="mt-1 text-xs">目前帳號沒有設備控制權限，只能檢視。</p>}
      </div>

      {tracking && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm" role="status" data-cmd-status>
          {tracking.status === 'SENT' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          <span>最近一筆指令：</span>
          <Pill tone={STATUS[tracking.status]?.tone ?? 'gray'}>{STATUS[tracking.status]?.label ?? tracking.status}</Pill>
          {tracking.simulated && <Pill tone="violet">模擬結果</Pill>}
          {tracking.error && <span className="text-xs text-red-700">{tracking.error}</span>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {courts.map((c) => (
          <article key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="font-semibold">{c.name}</h3>
            <p className="text-xs text-muted">{c.usage ? `依預約推估：${c.usage}` : '依預約推估：目前沒有預約'}</p>
            <ul className="mt-3 space-y-2">
              {c.devices.length === 0 && <li className="text-sm text-muted">沒有可控制的設備</li>}
              {c.devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 p-2">
                  <span className="text-sm">
                    {d.typeLabel}・{d.name}
                    <span className="ml-1 text-xs text-muted">
                      {STATE_LABEL[d.state]}
                      {d.lastAction ? `・${d.lastAction}` : ''}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {d.actions.map((a) => (
                      <button
                        key={a.action}
                        type="button"
                        disabled={!canControl || busy || d.state === 'NOT_CONNECTED'}
                        onClick={() => open(d.id, a.action)}
                        className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={d.state === 'NOT_CONNECTED' ? '設備尚未串接' : undefined}
                      >
                        {a.label}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">指令紀錄</h2>
        {commands.length === 0 ? (
          <p className="mt-2 text-sm text-muted">尚無指令</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {commands.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{c.label}</span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Pill tone={STATUS[c.status]?.tone ?? 'gray'}>{STATUS[c.status]?.label ?? c.status}</Pill>
                  {c.simulated && <Pill tone="violet">模擬</Pill>}
                  {new Date(c.at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}・{c.by}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent title="設備操作預覽" description="確認後才會送出，這次確認只適用這一個操作">
          {preview && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1">
                <dt className="text-muted">場館</dt>
                <dd>{preview.venue}</dd>
                <dt className="text-muted">場地</dt>
                <dd>{preview.court}</dd>
                <dt className="text-muted">設備</dt>
                <dd>{preview.device.typeLabel}・{preview.device.name}</dd>
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
              <Field label="原因（記錄於操作紀錄）" htmlFor="cmd-reason">
                <Input id="cmd-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="例：客人到場門禁無法感應" />
              </Field>
              <div className="flex gap-2">
                <button type="button" disabled={busy || preview.blockers.length > 0} onClick={send} className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
                  {busy ? '送出中…' : `確認${preview.actionLabel}`}
                </button>
                <button type="button" onClick={() => setPreview(null)} className="h-11 rounded-xl border border-zinc-300 px-4">取消</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
