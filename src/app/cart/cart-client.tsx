'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AlertTriangle, CalendarPlus, Clock, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useHoldCountdown, formatCountdown } from '@/components/booking/cart-bar'
import { useSetCart } from '@/store/cart'
import { emptyCart, fetchCart, removeCartItem } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { cn, ntd } from '@/lib/utils'
import type { CartActivityItemDTO, CartDTO, CartItemDTO, CartProductItemDTO } from '@/lib/types'
import { CartActivityItems } from '@/components/activities/cart-activity-items'
import { removeActivityFromCart } from '@/server/activity-actions'

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

  const handleRemoveActivity = async (item: CartActivityItemDTO) => {
    setBusyId(item.registrationId)
    try {
      const res = await removeActivityFromCart(item.registrationId)
      if (res.ok) apply(res.cart)
      else toast(res.error, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemoveProduct = async (item: CartProductItemDTO) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/cart-product?id=${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        apply(data.cart)
        toast(`已移除「${item.productName}」`, 'info')
      } else {
        const error = await res.json()
        toast(error.error || '移除商品失敗', 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleUpdateProductQuantity = async (item: CartProductItemDTO, newQuantity: number) => {
    if (newQuantity <= 0) return
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/cart-product?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      })
      if (res.ok) {
        const data = await res.json()
        apply(data.cart)
      } else {
        const error = await res.json()
        toast(error.error || '更新商品失敗', 'error')
      }
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

  const activityItems = cart.activityItems ?? []
  const productItems = cart.productItems ?? []
  if (cart.items.length === 0 && activityItems.length === 0 && productItems.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl surface-2 text-[rgb(var(--fg-muted))]">
          <ShoppingCart className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">購物車是空的</h1>
        <p className="mt-1 text-sm text-muted">先挑一個日期選擇場地與時段，或報名活動，或前往商城購買運動裝備吧！</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild variant="secondary">
            <Link href="/booking">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              預約場地
            </Link>
          </Button>
          <Button asChild>
            <Link href="/shop">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              前往商城
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // 依日期分組，同一天的時段排在一起
  const groups = cart.items.reduce<Record<string, CartItemDTO[]>>((acc, item) => {
    ;(acc[item.date] ??= []).push(item)
    return acc
  }, {})

  const urgent = remaining > 0 && remaining <= 120
  const invalidCount = cart.invalidCount ?? 0

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
            系統為您保留這些項目，請於 <strong className="tabular">{formatCountdown(remaining)}</strong> 內完成結帳
          </span>
        ) : (
          <span>保留已逾時，請重新選擇時段</span>
        )}
      </div>

      {invalidCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            有 {invalidCount} 個項目已開始或已超過預約截止時間，無法結帳。請移除標示為「已失效」的項目後重新選擇。
          </span>
        </div>
      )}

      <CartActivityItems items={activityItems} onRemove={handleRemoveActivity} busyId={busyId} />

      {/* 商品項目 */}
      {productItems.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold">商城商品</h2>
            <Separator />
            <ul className="divide-y divide-[rgb(var(--border))]">
              {productItems.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {/* 商品圖片 */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted">無圖片</div>
                    )}
                  </div>

                  {/* 商品資訊與操作 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.productName}</span>
                      <span className="text-xs text-muted">SKU: {item.productSku}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-[rgb(var(--fg))]">{ntd(item.unitPrice)}</p>

                    {/* 數量控制 */}
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateProductQuantity(item, item.quantity - 1)}
                        disabled={busyId === item.id || item.quantity <= 1}
                        className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
                        aria-label="減少"
                      >
                        <Minus className="h-3 w-3" aria-hidden />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateProductQuantity(item, item.quantity + 1)}
                        disabled={busyId === item.id}
                        className="rounded p-1 hover:bg-gray-100 disabled:opacity-40"
                        aria-label="增加"
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {/* 小計與刪除 */}
                  <div className="flex flex-col items-end justify-between gap-2">
                    <span className="text-sm font-semibold tabular">{ntd(item.subtotal)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(item)}
                      disabled={busyId === item.id}
                      aria-label={`移除 ${item.productName}`}
                      className="rounded-lg p-2 text-[rgb(var(--fg-muted))] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {Object.entries(groups).map(([date, items]) => (
        <Card key={date}>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold">場地租借・{formatDateFull(date)}</h2>
            <Separator />
            <ul className="divide-y divide-[rgb(var(--border))]">
              {items.map((item) => (
                <li key={item.reservationId} className={cn('flex items-center gap-3 py-3 first:pt-0 last:pb-0', item.invalid && 'opacity-80')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.courtName}</span>
                      <Badge variant={item.rateName === '尖峰' ? 'peak' : 'offpeak'}>{item.rateName}</Badge>
                      {item.invalid && <Badge variant="danger">已失效・{item.invalid}</Badge>}
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
          <span className="text-sm text-muted">
            小計（{[cart.items.length > 0 && `場地 ${cart.items.length} 個時段`, activityItems.length > 0 && `活動 ${activityItems.length} 場`].filter(Boolean).join('、')}）
          </span>
          <span className="text-xl font-semibold tabular">{ntd(cart.subtotal)}</span>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" asChild className="flex-1">
          <Link href="/booking">繼續選擇</Link>
        </Button>
        <Button className="flex-[2]" onClick={() => router.push('/checkout')} disabled={remaining <= 0 || invalidCount > 0}>
          {invalidCount > 0 ? '請先移除失效項目' : '前往結帳'}
        </Button>
      </div>
    </div>
  )
}
