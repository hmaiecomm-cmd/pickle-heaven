'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Pill } from '@/components/admin/page-bits'
import { toggleAlwaysOpenAction } from './actions'

export interface AlwaysOpenToggleProps {
  isOpen: boolean
  demo: boolean
  canControl: boolean
}

/**
 * 常開模式滑動開關 - iPhone 式設計
 * 支援滑鼠點擊、手指滑動、平板觸控
 */
export function AlwaysOpenToggle({ isOpen, demo, canControl }: AlwaysOpenToggleProps) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState(0)
  const toggleRef = React.useRef<HTMLDivElement>(null)

  const handleToggle = async () => {
    if (busy || !canControl) return

    setBusy(true)
    try {
      const result = await toggleAlwaysOpenAction(isOpen ? 'OFF' : 'ON')
      if (result.ok) {
        router.refresh()
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
    const rect = toggleRef.current.getBoundingClientRect()
    const toggleWidth = rect.width

    // 判斷滑動方向：向右滑動 > 15px 則打開，向左滑動 > 15px 則關閉
    if (Math.abs(diff) > 15) {
      if (diff > 0 && !isOpen) {
        // 向右滑動 - 打開常開模式
        handleToggle()
        setIsDragging(false)
      } else if (diff < 0 && isOpen) {
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
      <div className="space-y-3">
        {/* 標題與說明 */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">常開模式</h2>
            <p className="mt-1 text-xs text-muted">向右滑動開啟，向左滑動關閉</p>
          </div>
          {demo && <Pill tone="violet">Demo 模擬</Pill>}
        </div>

        {/* 滑動開關 - iPhone 風格 */}
        <div className="flex items-center gap-3">
          {/* 狀態標籤 */}
          <div className="flex-1">
            <div
              ref={toggleRef}
              role="switch"
              aria-checked={isOpen}
              aria-label={isOpen ? '常開模式已開啟' : '常開模式已關閉'}
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
                isOpen
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
                  isOpen ? 'translate-x-9' : 'translate-x-0'
                )}
              />

              {/* 狀態文字（可選，小屏幕隱藏） */}
              <span className="relative z-10 ml-auto text-[10px] font-semibold text-gray-600 select-none pointer-events-none hidden sm:inline">
                {isOpen ? '開' : '關'}
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

        {/* 狀態描述 */}
        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2">
            {isOpen ? (
              <>
                <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-green-700 font-medium">常開模式已開啟</span>
              </>
            ) : (
              <>
                <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-zinc-400 shrink-0" />
                <span className="text-zinc-700 font-medium">常開模式已關閉</span>
              </>
            )}
          </div>
        </div>

        {/* Demo Mode 提示 */}
        {demo && (
          <div className="rounded-lg bg-violet-50 p-2 text-xs text-violet-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>Demo Mode：操作只更新示意狀態，不會送出實際指令</span>
          </div>
        )}

        {/* 權限限制提示 */}
        {!canControl && (
          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>目前帳號沒有修改常開模式的權限</span>
          </div>
        )}

        {/* 功能說明 */}
        <p className="text-xs text-muted">
          開啟常開模式後，大門保持常開狀態；關閉後恢復一般門禁控制。常開模式與一鍵強制開門是不同的功能。
        </p>
      </div>
    </section>
  )
}
