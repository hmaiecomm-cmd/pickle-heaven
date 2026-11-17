'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleAlwaysOpenAction } from './actions'

export interface AlwaysOpenToggleProps {
  isOpen: boolean
  canControl: boolean
}

/**
 * 常開模式滑動開關 - iPhone 式設計
 * 支援滑鼠點擊、手指滑動、平板觸控
 */
export function AlwaysOpenToggle({ isOpen, canControl }: AlwaysOpenToggleProps) {
  const [open, setOpen] = React.useState(isOpen)
  const [busy, setBusy] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState(0)
  const toggleRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setOpen(isOpen), [isOpen])

  const handleToggle = async () => {
    if (busy || !canControl) return

    setBusy(true)
    try {
      const nextOpen = !open
      const result = await toggleAlwaysOpenAction(nextOpen ? 'ON' : 'OFF')
      if (result.ok) {
        setOpen(nextOpen)
      } else {
        // 錯誤訊息在 Server Action 中處理
        console.error('切換失敗:', result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  // 滑動開始
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!canControl || busy) return

    setIsDragging(true)
    if ('clientX' in e) {
      setDragStart(e.clientX)
    } else if (e.touches?.[0]) {
      setDragStart(e.touches[0].clientX)
    }
  }

  // 滑動中
  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !toggleRef.current) return

    let currentX = 0
    if ('clientX' in e) {
      currentX = e.clientX
    } else if (e.touches?.[0]) {
      currentX = e.touches[0].clientX
    }

    const diff = currentX - dragStart
    // 判斷滑動方向：向右滑動 > 15px 則打開，向左滑動 > 15px 則關閉
    if (Math.abs(diff) > 15) {
      if (diff > 0 && !open) {
        // 向右滑動 - 打開常開模式
        handleToggle()
        setIsDragging(false)
      } else if (diff < 0 && open) {
        // 向左滑動 - 關閉常開模式
        handleToggle()
        setIsDragging(false)
      }
    }
  }

  // 滑動結束
  const handleDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">常開模式</h2>
        <div className="flex items-center gap-3">
          {/* 狀態標籤 */}
          <div className="flex-1">
            <div
              ref={toggleRef}
              role="switch"
              aria-checked={open}
              aria-label={open ? '常開模式已開啟' : '常開模式已關閉'}
              tabIndex={canControl && !busy ? 0 : -1}
              onClick={handleToggle}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              className={cn(
                // 基礎樣式
                'relative h-12 w-20 cursor-pointer rounded-full border-2 transition-all duration-200',
                'flex items-center px-1',

                // 狀態樣式
                open
                  ? 'border-green-500 bg-green-500'
                  : 'border-zinc-300 bg-white',

                // 禁用狀態
                !canControl || busy
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:shadow-sm active:shadow-md',

                // 拖動狀態
                isDragging && 'shadow-lg'
              )}
            >
              {/* 滑塊 */}
              <div
                className={cn(
                  'absolute h-10 w-10 rounded-full bg-white shadow-md transition-transform duration-150',
                  open ? 'translate-x-9' : 'translate-x-0'
                )}
              />

              {/* 狀態文字（可選，小屏幕隱藏） */}
              <span className="relative z-10 ml-auto text-[10px] font-semibold text-gray-600 select-none pointer-events-none hidden sm:inline">
                {open ? '開' : '關'}
              </span>
            </div>
          </div>

          {/* 加載指示 */}
          {busy && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
