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
  alwaysOpen: boolean
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
        </div>
        {state.demo && <Pill tone="violet">Demo 模擬</Pill>}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm">{state.door.name}</p>
          <p className="text-xs text-muted">{state.door.location}</p>
        </div>

        <Button
          size="lg"
          onClick={ask}
          disabled={!!blocked || busy}
          title={blocked ?? undefined}
          className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <DoorOpen className="h-5 w-5" aria-hidden />}
          {busy ? '開門中…' : '一鍵強制開門'}
        </Button>
      </div>

      {blocked && <p className="mt-3 text-xs text-muted">{blocked}</p>}

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </p>
      )}
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
