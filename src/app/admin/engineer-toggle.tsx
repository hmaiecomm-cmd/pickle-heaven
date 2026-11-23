'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * 後台首頁右下角的隱藏按鍵：一鍵把 IoT 連線對象切到「網頁模擬器」（或切回實體 IoT PC）。
 * 切換後 設備總覽／手動控制／即時監控 的狀態、指令與影像都會改走模擬器。
 * 平時只顯示一個小圓點；模擬器模式時顯示明顯的提示，避免忘記切回來。
 */
export function EngineerToggle({ venueId, target }: { venueId: string; target: 'LIVE' | 'SIMULATOR' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const sim = target === 'SIMULATOR'

  async function flip() {
    const to = sim ? 'LIVE' : 'SIMULATOR'
    if (!confirm(to === 'SIMULATOR' ? '切換到「IoT 模擬器」？控制、監控與設備狀態都會改成模擬器的回應。' : '切回「實體 IoT PC」？之後的控制會送到現場真實設備。')) return
    setBusy(true)
    const r = await fetch('/api/admin/engineer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venue: venueId, action: 'target', target: to }) })
    setBusy(false)
    if (!r.ok) alert((await r.json().catch(() => null))?.error ?? '切換失敗')
    router.refresh()
  }

  if (sim)
    return (
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-blue-300 bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        IoT 模擬器模式
        <Link href="/admin/engineer_testmode" className="underline">
          工程測試
        </Link>
        <button type="button" disabled={busy} onClick={() => void flip()} className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30">
          切回實體
        </button>
      </div>
    )

  return (
    <div className="fixed bottom-3 right-3 z-40 flex items-center gap-2" onMouseLeave={() => setOpen(false)}>
      {open && (
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs shadow">
          <button type="button" disabled={busy} onClick={() => void flip()} className="font-semibold text-blue-700">
            切到 IoT 模擬器
          </button>
          <Link href="/admin/engineer_testmode" className="text-muted-foreground underline">
            工程測試
          </Link>
        </div>
      )}
      <button type="button" aria-label="工程測試" title="工程測試" onClick={() => setOpen((o) => !o)} className="h-3 w-3 rounded-full bg-gray-300/60 hover:bg-gray-400" />
    </div>
  )
}
