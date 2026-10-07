'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { creditTopUpAction } from '@/server/topup-admin-actions'

export function CreditButton({ orderId, code }: { orderId: string; code: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`補入儲值單 ${code} 的點數？若先前已入帳不會重複。`)) return
        setBusy(true)
        const res = await creditTopUpAction(orderId)
        setBusy(false)
        if (!res.ok) return toast(res.error, 'error')
        toast(res.message ?? '完成', 'success')
        router.refresh()
      }}
      className="h-8 rounded-lg bg-brand-600 px-2 text-xs font-semibold text-white disabled:opacity-40"
    >
      補入點數
    </button>
  )
}
