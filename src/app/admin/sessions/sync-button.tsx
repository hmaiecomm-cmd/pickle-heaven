'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { syncOccupancyAction } from '@/server/activity-admin-actions'

/** 已有場地但尚未占用的既有場次：逐場補建占用，遇衝突回報不覆蓋 */
export function SyncOccupancyButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const res = await syncOccupancyAction()
          if (!res.ok) return toast(res.message, 'error')
          const c = res.conflicts
          toast(`已補上 ${res.fixed} 場占用${c.length > 0 ? `；${c.length} 場有衝突未處理：${c.map((x) => `${x.label}（${x.reason}）`).join('；')}` : ''}`, c.length > 0 ? 'info' : 'success')
          router.refresh()
        } finally {
          setBusy(false)
        }
      }}
      className="ml-2 rounded-lg border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
    >
      {busy ? '處理中…' : '一鍵補占用'}
    </button>
  )
}
