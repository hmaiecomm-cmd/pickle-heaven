'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Pill } from '@/components/admin/page-bits'
import { remoteOpenDoorAction, type DoorOpenResult } from './actions'

export interface DoorRemoteState {
  door: { name: string; location: string; pulseSeconds: number }
  demo: boolean
  connection: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR'
  last: { at: string; status: string; simulated: boolean; requestedBy: string } | null
}

const CONNECTION: Record<DoorRemoteState['connection'], { label: string; tone: 'green' | 'gray' | 'red' }> = {
  CONNECTED: { label: '已連線', tone: 'green' },
  NOT_CONNECTED: { label: '未連線', tone: 'gray' },
  ERROR: { label: '異常', tone: 'red' },
}
const RESULT_TEXT: Record<string, string> = {
  SENT: '已送出，等待設備確認',
  SUCCEEDED: '大門已成功開啟',
  OFFLINE: '設備離線，無法開門',
  TIMEOUT: '設備未在時限內回報，無法確認是否已開門',
  FAILED: '門禁控制器回報開門失敗',
}
const SIMULATE = [
  ['SUCCESS', '成功'],
  ['OFFLINE', '設備離線'],
  ['TIMEOUT', '逾時'],
  ['FAILED', '控制失敗'],
] as const
const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** 大門即時控制：一次瞬間開門脈衝，不建立授權。 */
export function DoorRemoteCard({ state, canRemote }: { state: DoorRemoteState; canRemote: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [simulate, setSimulate] = React.useState<(typeof SIMULATE)[number][0]>('SUCCESS')
  const [result, setResult] = React.useState<DoorOpenResult | null>(null)
  const keyRef = React.useRef('')

  const blocked = !canRemote ? '目前帳號沒有「遠端開門」權限' : !state.demo && state.connection !== 'CONNECTED' ? '設備未連線，無法遠端開門' : null
  const conn = CONNECTION[state.connection]

  const ask = () => {
    keyRef.current = `door-${crypto.randomUUID()}`
    setResult(null)
    setConfirming(true)
  }
  const open = async () => {
    setConfirming(false)
    setBusy(true)
    try {
      setResult(await remoteOpenDoorAction(keyRef.current, state.demo ? simulate : undefined))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const success = result?.ok && result.status === 'SUCCEEDED'
  const message = !result
    ? null
    : !result.ok
      ? result.error
      : result.simulated
        ? `${RESULT_TEXT[result.status] ?? result.status}（Demo 模擬，未實際開門）`
        : (RESULT_TEXT[result.status] ?? result.status)

  return (
    <section aria-labelledby="door-remote-title" className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="door-remote-title" className="text-sm font-semibold">大門即時控制</h2>
          <p className="mt-0.5 text-xs text-muted">管理員可遠端即時開啟球場大門。</p>
        </div>
        {state.demo && <Pill tone="violet">Demo 模擬</Pill>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-2 text-sm">
          <dt className="text-muted">門禁設備</dt>
          <dd>
            {state.door.name}
            <span className="ml-1 text-xs text-muted">{state.door.location}</span>
          </dd>
          <dt className="text-muted">連線狀態</dt>
          <dd>
            <Pill tone={conn.tone}>{conn.label}</Pill>
            {state.demo && <span className="ml-2 text-xs text-muted">尚未串接門禁控制器，以模擬結果示範流程</span>}
          </dd>
          <dt className="text-muted">最後操作</dt>
          <dd data-door-last>
            {state.last ? (
              <>
                {fmt(state.last.at)}・{RESULT_TEXT[state.last.status] ?? state.last.status}
                {state.last.simulated && '（模擬）'}
                <span className="ml-1 text-xs text-muted">{state.last.requestedBy}</span>
              </>
            ) : (
              <span className="text-muted">尚無紀錄</span>
            )}
          </dd>
        </dl>

        <div className="flex flex-col gap-2 sm:items-end">
          {state.demo && canRemote && (
            <label className="flex items-center gap-2 text-xs text-muted">
              模擬結果
              <select value={simulate} onChange={(e) => setSimulate(e.target.value as typeof simulate)} disabled={busy} className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-[rgb(var(--fg))]">
                {SIMULATE.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button size="lg" onClick={ask} disabled={!!blocked || busy} title={blocked ?? undefined} className="w-full bg-red-600 hover:bg-red-700 sm:w-auto">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <DoorOpen className="h-5 w-5" aria-hidden />}
            {busy ? '開門中…' : '一鍵強制開門'}
          </Button>
          {blocked && <p className="text-xs text-muted">{blocked}</p>}
        </div>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted">
        瞬間開門：開啟約 {state.door.pulseSeconds} 秒後自動上鎖，不會永久解鎖，也不會建立門禁授權；消防、緊急逃生與安全聯鎖由門禁控制器負責。
      </p>

      <Sheet open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <SheetContent title="確認開門" description="這次確認只會送出一次開門指令">
          <div className="space-y-4 text-sm">
            <p className="text-base font-semibold">確定要立即開啟{state.door.name}嗎？</p>
            {state.demo && <Pill tone="violet">Demo 模式：只會產生模擬結果（{SIMULATE.find(([v]) => v === simulate)?.[1]}），不會真的開門</Pill>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={open}>
                確認開門
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
