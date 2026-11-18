'use client'

import * as React from 'react'
import Link from 'next/link'
import { CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DoorMonitorCardProps {
  camera?: {
    id: string
    name: string
    demo: {
      main: string
      mainPosition: string
      thumb?: string
      thumbPosition?: string
    } | null
  }
  canMonitor: boolean
}

/**
 * 首頁大門監視器卡片 - 顯示大門實時監視器影像
 * 手機、平板、電腦版都全寬顯示
 */
export function DoorMonitorCard({ camera, canMonitor }: DoorMonitorCardProps) {
  if (!canMonitor || !camera?.demo) {
    return null
  }

  return (
    <Link
      href="/admin/monitor"
      className="group relative block w-full overflow-hidden rounded-[28px] border border-[#e6eadf] bg-white/95 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all hover:shadow-[0_8px_24px_rgba(31,77,52,0.12)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342]"
    >
      {/* 監視器影像容器 */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
        {/* 背景影像 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${camera.demo.main}')`,
            backgroundPosition: camera.demo.mainPosition || 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* LIVE 標籤 */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 sm:px-3 sm:py-1.5">
          <CircleDot className="h-2 w-2 sm:h-2.5 sm:w-2.5 fill-red-600 text-white animate-pulse" aria-hidden />
          <span className="text-xs sm:text-sm font-bold text-white">LIVE</span>
        </div>

        {/* 大門名稱 */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 rounded-lg bg-black/60 px-2.5 py-1.5 sm:px-3 sm:py-2">
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{camera.name}</p>
        </div>

        {/* 進入監控提示 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="text-white text-sm sm:text-base font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            進入即時監控
          </span>
        </div>
      </div>

      {/* 底部資訊 */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-[#666] truncate">點擊查看完整監控畫面</p>
        </div>
        <span className="text-xs sm:text-sm font-medium text-[#7cb342]">→</span>
      </div>
    </Link>
  )
}
