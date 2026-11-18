'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { remoteOpenDoorAction, toggleAlwaysOpenAction, type DoorOpenResult } from './access/actions'

interface AccessQuickCardProps {
  doorState: {
    door: { name: string; location: string; pulseSeconds: number }
    demo: boolean
    connection: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR'
    alwaysOpen: boolean
    last: { at: string; status: string; simulated: boolean; requestedBy: string } | null
  }
  canRemote: boolean
}

const CONNECTION: Record<string, { label: string; color: string }> = {
  CONNECTED: { label: '已連線', color: 'text-emerald-600' },
  NOT_CONNECTED: { label: '未連線', color: 'text-zinc-500' },
  ERROR: { label: '異常', color: 'text-red-600' },
}

const RESULT_TEXT: Record<string, string> = {
  SENT: '已送出，等待設備確認',
  SUCCEEDED: '大門已成功開啟',
  OFFLINE: '設備離線，無法開門',
  TIMEOUT: '設備未在時限內回報，無法確認是否已開門',
  FAILED: '門禁控制器回報開門失敗',
}

/**
 * 首頁門禁快捷卡片 - 大門機制控制 + 常開模式
 * 桌面版、平板版、手機版都左右並排
 */
export function AccessQuickCard({ doorState, canRemote }: AccessQuickCardProps) {
  const router = useRouter()
  const [alwaysOpen, setAlwaysOpen] = React.useState(doorState.alwaysOpen)
  const [confirming, setConfirming] = React.useState(false)
  const [openDoorBusy, setOpenDoorBusy] = React.useState(false)
  const [toggleBusy, setToggleBusy] = React.useState(false)
  const [openDoorResult, setOpenDoorResult] = React.useState<DoorOpenResult | null>(null)
  const keyRef = React.useRef('')

  const connectionInfo = CONNECTION[doorState.connection]
  const blocked = !canRemote
    ? '目前帳號沒有遠端開門權限'
    : !doorState.demo && doorState.connection !== 'CONNECTED'
      ? '設備未連線，無法遠端開門'
      : null

  const formatLastTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const askOpen = () => {
    if (blocked) return
    keyRef.current = `door-${crypto.randomUUID()}`
    setOpenDoorResult(null)
    setConfirming(true)
  }

  const confirmOpen = async () => {
    setConfirming(false)
    setOpenDoorBusy(true)
    try {
      setOpenDoorResult(await remoteOpenDoorAction(keyRef.current, doorState.demo ? 'SUCCESS' : undefined))
      router.refresh()
    } finally {
      setOpenDoorBusy(false)
    }
  }

  const handleToggleAlwaysOpen = async () => {
    if (toggleBusy || !canRemote) return

    setToggleBusy(true)
    try {
      const nextOpen = !alwaysOpen
      const result = await toggleAlwaysOpenAction(nextOpen ? 'ON' : 'OFF')
      if (result.ok) {
        setAlwaysOpen(nextOpen)
      } else {
        console.error('切換失敗:', result.error)
      }
    } finally {
      setToggleBusy(false)
    }
  }

  const success = openDoorResult?.ok && openDoorResult.status === 'SUCCEEDED'
  const doorMessage = !openDoorResult
    ? null
    : !openDoorResult.ok
      ? openDoorResult.error
      : openDoorResult.simulated
        ? `${RESULT_TEXT[openDoorResult.status] ?? openDoorResult.status}（Demo 模擬）`
        : (RESULT_TEXT[openDoorResult.status] ?? openDoorResult.status)

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:gap-5">
        {/* 左側：大門機制控制 */}
        <div className="flex flex-col items-start justify-between gap-3 rounded-[28px] border border-[#e6eadf] bg-white/95 px-4 py-4 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all focus-visible:outline-none sm:px-5 sm:py-5 sm:gap-4 md:aspect-square lg:gap-5">
          <div className="flex w-full items-start justify-between gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-[#1f2a22] truncate sm:text-base md:text-lg">大門機制控制</h3>
              <p className="mt-0.5 text-xs text-[#666] truncate sm:mt-1 sm:text-sm">{doorState.door.name}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#fee2e2] to-[#fecaca] transition-colors sm:h-11 sm:w-11 md:h-12 md:w-12">
              <DoorOpen className="h-5 w-5 text-[#dc2626] sm:h-5.5 sm:w-5.5 md:h-6 md:w-6" strokeWidth={1.7} aria-hidden />
            </span>
          </div>

          {/* 狀態與按鈕 */}
          <div className="w-full space-y-2 flex-1 flex flex-col justify-between sm:space-y-3">
            {/* 狀態指示 */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className={cn('h-2 w-2 rounded-full', connectionInfo.color === 'text-emerald-600' ? 'bg-emerald-600' : connectionInfo.color === 'text-red-600' ? 'bg-red-600' : 'bg-zinc-400')} />
              <span className={connectionInfo.color}>{connectionInfo.label}</span>
            </div>

            {/* 開門結果 */}
            {doorMessage && (
              <div className={cn('rounded-lg px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm', success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
                {doorMessage}
              </div>
            )}

            {/* 最後操作時間 */}
            {doorState.last && (
              <div className="flex items-center gap-1 text-xs text-[#666] sm:gap-1.5 sm:text-sm">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                <span className="truncate">{formatLastTime(doorState.last.at)}</span>
              </div>
            )}

            {/* 開門按鈕 */}
            <Button
              onClick={askOpen}
              disabled={!!blocked || openDoorBusy}
              title={blocked ?? undefined}
              className="mt-auto w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
            >
              {openDoorBusy ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1" aria-hidden /> : <DoorOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1" aria-hidden />}
              {openDoorBusy ? '開門中' : '一鍵開門'}
            </Button>
          </div>

          {blocked && <p className="text-xs text-[#dc2626] leading-tight">{blocked}</p>}
        </div>

        {/* 右側：常開模式 */}
        <div className="flex flex-col items-start justify-between gap-3 rounded-[28px] border border-[#e6eadf] bg-white/95 px-4 py-4 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all focus-visible:outline-none sm:px-5 sm:py-5 sm:gap-4 md:aspect-square lg:gap-5">
          <div className="flex w-full items-start justify-between gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-[#1f2a22] truncate sm:text-base md:text-lg">常開模式</h3>
              <p className="mt-0.5 text-xs text-[#666] truncate sm:mt-1 sm:text-sm">24小時自動開放</p>
            </div>
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors sm:h-11 sm:w-11 md:h-12 md:w-12',
                alwaysOpen ? 'bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0]' : 'bg-gradient-to-br from-[#f3f4f6] to-[#e5e7eb]'
              )}
            >
              <div
                className={cn(
                  'relative h-5 w-8 cursor-pointer rounded-full border-2 transition-all duration-200',
                  'flex items-center px-0.5',
                  alwaysOpen ? 'border-green-500 bg-green-500' : 'border-zinc-300 bg-white',
                  !canRemote || toggleBusy ? 'cursor-not-allowed opacity-60' : 'active:shadow-md hover:shadow-sm',
                  'sm:h-6 sm:w-10'
                )}
                role="switch"
                aria-checked={alwaysOpen}
                aria-label={alwaysOpen ? '常開模式已開啟' : '常開模式已關閉'}
                tabIndex={canRemote && !toggleBusy ? 0 : -1}
                onClick={handleToggleAlwaysOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleToggleAlwaysOpen()
                  }
                }}
              >
                {/* 滑塊 */}
                <div
                  className={cn(
                    'absolute h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-150',
                    alwaysOpen ? 'translate-x-3' : 'translate-x-0',
                    'sm:h-5 sm:w-5 sm:translate-x-4 sm:translate-x-0'
                  )}
                  style={{
                    transform: alwaysOpen ? 'translateX(0.75rem)' : 'translateX(0)',
                  }}
                />
                {/* 加載指示 */}
                {toggleBusy && <Loader2 className="absolute left-1/2 h-2 w-2 -translate-x-1/2 animate-spin text-brand-600 sm:h-3 sm:w-3" aria-hidden />}
              </div>
            </span>
          </div>

          {/* 狀態與說明 */}
          <div className="w-full space-y-2 flex-1 flex flex-col justify-between sm:space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-[#666]">目前狀態：</span>
              <span className={cn('font-medium', alwaysOpen ? 'text-emerald-700' : 'text-zinc-600')}>
                {alwaysOpen ? '已開啟' : '已關閉'}
              </span>
            </div>

            {!canRemote && (
              <p className="text-xs text-[#dc2626] leading-tight">無權限切換</p>
            )}
          </div>
        </div>
      </div>

      {/* 開門確認彈窗 */}
      <Sheet open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <SheetContent title="確認開門" description="這次確認只會送出一次開門指令">
          <div className="space-y-3 text-sm sm:space-y-4">
            <p className="text-base font-semibold">確定要立即開啟{doorState.door.name}嗎？</p>
            {doorState.demo && (
              <div className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
                <p className="font-medium">Demo 模式</p>
                <p className="text-xs mt-1">只會產生模擬結果，不會真的開門</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmOpen} disabled={openDoorBusy}>
                {openDoorBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> : null}
                確認開門
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={openDoorBusy}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
