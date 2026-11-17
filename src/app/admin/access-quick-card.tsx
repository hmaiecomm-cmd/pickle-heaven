'use client'

import * as React from 'react'
import Link from 'next/link'
import { DoorOpen, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleAlwaysOpenAction } from './access/actions'

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

/**
 * 首頁門禁快捷卡片 - 大門機制控制 + 常開模式
 * 桌面版左右並排，手機版自動上下排列
 */
export function AccessQuickCard({ doorState, canRemote }: AccessQuickCardProps) {
  const [alwaysOpen, setAlwaysOpen] = React.useState(doorState.alwaysOpen)
  const [busy, setBusy] = React.useState(false)

  const handleToggleAlwaysOpen = async () => {
    if (busy || !canRemote) return

    setBusy(true)
    try {
      const nextOpen = !alwaysOpen
      const result = await toggleAlwaysOpenAction(nextOpen ? 'ON' : 'OFF')
      if (result.ok) {
        setAlwaysOpen(nextOpen)
      } else {
        console.error('切換失敗:', result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2">
      {/* 左側：大門機制控制 */}
      <Link
        href="/admin/access"
        className="group flex flex-col items-start justify-between gap-3 rounded-[28px] border border-[#e6eadf] bg-white/95 px-5 py-5 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(31,77,52,0.12)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] md:aspect-square"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-[15px] font-bold tracking-tight text-[#1f2a22] sm:text-lg">大門機制控制</h3>
            <p className="mt-1 text-xs text-[#666] sm:text-sm">{doorState.door.name}</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#fee2e2] to-[#fecaca] transition-colors group-hover:from-[#fecaca] group-hover:to-[#fca5a5] sm:h-12 sm:w-12">
            <DoorOpen className="h-5 w-5 text-[#dc2626] sm:h-6 sm:w-6" strokeWidth={1.7} aria-hidden />
          </span>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-[#666] sm:text-sm">進入門禁管理</span>
          <span className="text-xs font-medium text-[#dc2626]">→</span>
        </div>
      </Link>

      {/* 右側：常開模式 */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-[28px] border border-[#e6eadf] bg-white/95 px-5 py-5 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all focus-visible:outline-none md:aspect-square">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-[15px] font-bold tracking-tight text-[#1f2a22] sm:text-lg">常開模式</h3>
            <p className="mt-1 text-xs text-[#666] sm:text-sm">24小時自動開放</p>
          </div>
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors sm:h-12 sm:w-12',
              alwaysOpen
                ? 'bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0]'
                : 'bg-gradient-to-br from-[#f3f4f6] to-[#e5e7eb]'
            )}
          >
            <div
              className={cn(
                'relative h-6 w-10 cursor-pointer rounded-full border-2 transition-all duration-200',
                'flex items-center px-1',
                alwaysOpen ? 'border-green-500 bg-green-500' : 'border-zinc-300 bg-white',
                !canRemote || busy ? 'cursor-not-allowed opacity-60' : 'active:shadow-md'
              )}
              role="switch"
              aria-checked={alwaysOpen}
              aria-label={alwaysOpen ? '常開模式已開啟' : '常開模式已關閉'}
              tabIndex={canRemote && !busy ? 0 : -1}
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
                  'absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-150',
                  alwaysOpen ? 'translate-x-4' : 'translate-x-0'
                )}
              />
              {/* 加載指示 */}
              {busy && (
                <Loader2 className="absolute left-1/2 h-3 w-3 -translate-x-1/2 animate-spin text-brand-600" aria-hidden />
              )}
            </div>
          </span>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="text-xs font-medium text-[#666] sm:text-sm">
            {alwaysOpen ? (
              <span className="text-emerald-700">已開啟</span>
            ) : (
              <span className="text-zinc-600">已關閉</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
