'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Clock, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useHoldCountdown, formatCountdown } from '@/components/booking/cart-bar'
import { useSetCart } from '@/store/cart'
import { emptyCart, fetchCart, removeCartItem } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { cn, ntd } from '@/lib/utils'
import type { CartDTO, CartItemDTO } from '@/lib/types'

export function CartClient({ initialCart }: { initialCart: CartDTO }) {
  const router = useRouter()
  const { toast } = useToast()
  const setCartStore = useSetCart()
  const [cart, setCart] = React.useState(initialCart)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const apply = React.useCallback(
    (next: CartDTO) => {
      setCart(next)
      setCartStore(next)
    },
    [setCartStore],
  )

  const refresh = React.useCallback(async () => {
    apply(await fetchCart())
  }, [apply])

  const remaining = useHoldCountdown(cart.expiresAt, () => {
    toast('保留時間已到，時段已釋放', 'info')
    void refresh()
  })

  const handleRemove = async (item: CartItemDTO) => {
    setBusyId(item.reservationId)
    try {
      const res = await removeCartItem(item.reservationId)
      if (res.ok) apply(res.cart)
      else toast(res.error, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleClear = async () => {
    const res = await emptyCart()
    if (res.ok) {
      apply(res.cart)
      toast('已清空購物車', 'info')
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl surface-2 text-[rgb(var(--fg-muted))]">
          <ShoppingCart className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">購物車是空的</h1>
        <p className="mt-1 text-sm text-muted">先挑一個日期，選擇想打球的場地與時段吧！</p>
        <Button asChild className="mt-6">
          <Link href="/booking">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            開始選擇時段
          </Link>
        </Button>
      </div>
    )
  }

  // 依日期分組，同一天的時段排在一起
  const groups = cart.items.reduce<Record<string, CartItemDTO[]>>((acc, item) => {
    ;(acc[item.date] ??= []).push(item)
    return acc
  }, {})

  const urgent = remaining > 0 && remaining <= 120

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">購物車</h1>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-muted underline-offset-2 transition-colors hover:text-red-600 hover:underline"
        >
          清空
        </button>
      </div>

      {/* 保留倒數 */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs',
          urgent
            ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        )}
        role="status"
      >
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {remaining > 0 ? (
          <span>
            系統為您保留這些時段，請於 <strong className="tabular">{formatCountdown(remaining)}</strong> 內完成結帳
          </span>
        ) : (
          <span>保留已逾時，請重新選擇時段</span>
        )}
      </div>

      {Object.entries(groups).map(([date, items]) => (
        <Card key={date}>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold">{formatDateFull(date)}</h2>
            <Separator />
            <ul className="divide-y divide-[rgb(var(--border))]">
              {items.map((item) => (
                <li key={item.reservationId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.courtName}</span>
                      <Badge variant={item.rateName === '尖峰' ? 'peak' : 'offpeak'}>{item.rateName}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted tabular">{item.timeLabel}</p>
                  </div>
                  <span className="text-sm font-semibold tabular">{ntd(item.price)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={busyId === item.reservationId}
                    aria-label={`移除 ${item.courtName} ${item.timeLabel}`}
                    className="rounded-lg p-2 text-[rgb(var(--fg-muted))] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted">小計（{cart.items.length} 個時段）</span>
          <span className="text-xl font-semibold tabular">{ntd(cart.subtotal)}</span>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" asChild className="flex-1">
          <Link href="/booking">繼續選擇</Link>
        </Button>
        <Button className="flex-[2]" onClick={() => router.push('/checkout')} disabled={remaining <= 0}>
          前往結帳
        </Button>
      </div>
    </div>
  )
}
