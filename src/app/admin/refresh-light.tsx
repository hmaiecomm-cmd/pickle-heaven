'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/** 淺色頁面用的重新整理按鈕；可選擇自動定期更新 */
export function RefreshButtonLight({ autoSeconds }: { autoSeconds?: number }) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  React.useEffect(() => {
    if (!autoSeconds) return
    const t = setInterval(() => document.visibilityState === 'visible' && start(() => router.refresh()), autoSeconds * 1000)
    return () => clearInterval(t)
  }, [autoSeconds, router])
  return (
    <button type="button" onClick={() => start(() => router.refresh())} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">
      <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden />
      重新整理
    </button>
  )
}
