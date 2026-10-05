'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const POLL_INTERVAL = 1500
const MAX_ATTEMPTS = 14 // 約 21 秒

export function ResultClient({ bookingId, transactionId }: { bookingId: string; transactionId: string | null }) {
  const router = useRouter()
  const [status, setStatus] = React.useState<'checking' | 'pending' | 'failed'>('checking')

  React.useEffect(() => {
    let attempts = 0
    let stopped = false

    async function poll() {
      if (stopped) return
      attempts += 1

      try {
        // LINE Pay 需在導回時呼叫 confirm 才真正扣款
        const url = transactionId
          ? `/api/bookings/${bookingId}/status?transactionId=${encodeURIComponent(transactionId)}`
          : `/api/bookings/${bookingId}/status`
        const res = await fetch(url, { cache: 'no-store' })
        const data = (await res.json()) as { status?: string }

        if (data.status === 'PAID' || data.status === 'COMPLETED') {
          stopped = true
          router.replace(`/bookings/${bookingId}?new=1`)
          return
        }
        if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
          stopped = true
          setStatus('failed')
          return
        }
      } catch {
        /* 網路暫時異常，繼續重試 */
      }

      if (attempts >= MAX_ATTEMPTS) {
        setStatus('pending')
        return
      }
      setTimeout(poll, POLL_INTERVAL)
    }

    void poll()
    return () => {
      stopped = true
    }
  }, [bookingId, router, transactionId])

  if (status === 'checking') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" aria-hidden />
        <h1 className="mt-5 text-base font-semibold">確認付款結果中…</h1>
        <p className="mt-1.5 text-sm text-muted">正在與金流服務商核對交易，請勿關閉此頁面。</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardContent className="space-y-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50">
            <CircleAlert className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold">
              {status === 'failed' ? '這筆訂單未能完成' : '尚未收到付款確認'}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {status === 'failed'
                ? '訂單已取消或逾時，選取的時段已釋放，請重新預約。'
                : '若您已完成付款，款項確認可能需要一點時間。您可以稍後於「我的預約」查看最新狀態。'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild className="flex-1">
              <Link href="/booking">重新預約</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href={`/bookings/${bookingId}`}>查看訂單</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
