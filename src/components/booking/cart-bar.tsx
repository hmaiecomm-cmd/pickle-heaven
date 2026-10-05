'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, ntd } from '@/lib/utils'
import type { CartDTO } from '@/lib/types'

/** 暫扣倒數（秒）。到期時觸發 onExpire。 */
export function useHoldCountdown(expiresAt: string | null, onExpire?: () => void) {
  const [remaining, setRemaining] = React.useState<number>(() => secondsUntil(expiresAt))
  const firedRef = React.useRef(false)

  React.useEffect(() => {
    firedRef.current = false
    setRemaining(secondsUntil(expiresAt))
    if (!expiresAt) return

    const timer = setInterval(() => {
      const left = secondsUntil(expiresAt)
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onExpire?.()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, onExpire])

  return remaining
}

function secondsUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000))
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function CartBar({ cart, onExpire }: { cart: CartDTO; onExpire?: () => void }) {
  const router = useRouter()
  const remaining = useHoldCountdown(cart.expiresAt, onExpire)
  const count = cart.items.length

  if (count === 0) return null

  const urgent = remaining > 0 && remaining <= 120

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgb(var(--border))] surface shadow-bar animate-slide-up sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pb-safe sm:pb-3">
        <div className="relative shrink-0">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            <ShoppingCart className="h-5 w-5" aria-hidden />
          </span>
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white tabular">
            {count}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular">{ntd(cart.subtotal)}</span>
            <span className="text-xs text-muted">共 {count} 個時段</span>
          </div>
          <div
            className={cn(
              'mt-0.5 flex items-center gap-1 text-[11px] tabular',
              urgent ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted',
            )}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {remaining > 0 ? `保留剩餘 ${formatCountdown(remaining)}` : '保留已逾時'}
          </div>
        </div>

        <Button size="md" onClick={() => router.push('/cart')} className="shrink-0">
          前往結帳
        </Button>
      </div>
    </div>
  )
}
