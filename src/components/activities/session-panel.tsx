'use client'

import * as React from 'react'
import Link from 'next/link'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Bell, BellOff, CalendarDays, Clock, MapPin, Minus, Plus, ShoppingCart, Users, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/components/auth-provider'
import { useSetCart } from '@/store/cart'
import { REFUND_POLICY_ROWS } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { ActivitySessionDTO } from '@/lib/activity-shared'
import type { CartDTO } from '@/lib/types'
import { addActivityToCart, fetchSessionDetail, toggleSeatAlert } from '@/server/activity-actions'
import { ActivityCover, priceText, SignupBadge } from './activity-cover'

/**
 * 活動詳細面板：桌機為右側抽屜，手機為全螢幕。
 * 「報名這場活動」只會暫留名額並放入購物車，完成付款才算報名成功。
 * 未登入時先把場次與人數寫進網址，Google 登入回來後自動回到同一場次並保留人數。
 */
export function SessionPanel({
  sessionId,
  onClose,
  onCartChange,
  initialQuantity,
}: {
  sessionId: string | null
  onClose: () => void
  onCartChange?: (cart: CartDTO) => void
  initialQuantity?: number
}) {
  const { toast } = useToast()
  const { user, login, loggingIn } = useAuth()
  const setCartStore = useSetCart()
  const [dto, setDto] = React.useState<ActivitySessionDTO | null>(null)
  const [alertsEnabled, setAlertsEnabled] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [qty, setQty] = React.useState(initialQuantity ?? 1)
  const [pending, setPending] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const load = React.useCallback(async (id: string) => {
    setError(null)
    const res = await fetchSessionDetail(id)
    if (res.ok) {
      setDto(res.session)
      setAlertsEnabled(res.alertsEnabled)
      setQty((q) => {
        const base = res.session.mine?.status === 'IN_CART' ? res.session.mine.quantity : q
        return Math.max(1, Math.min(base, Math.max(1, res.session.maxQuantity)))
      })
    } else {
      setDto(null)
      setError(res.error)
    }
  }, [])

  React.useEffect(() => {
    setAdded(false)
    setDto(null)
    if (sessionId) void load(sessionId)
  }, [sessionId, load])

  // 登入完成後重新讀取（顯示自己的報名狀態）
  React.useEffect(() => {
    if (sessionId && user) void load(sessionId)
  }, [user, sessionId, load])

  React.useEffect(() => {
    if (initialQuantity) setQty(initialQuantity)
  }, [initialQuantity])

  const open = sessionId !== null

  const signIn = () => {
    if (!sessionId) return
    // 登入後回到同一場次並保留人數
    const url = new URL(window.location.href)
    url.searchParams.set('session', sessionId)
    url.searchParams.set('qty', String(qty))
    window.history.replaceState(null, '', url.toString())
    void login()
  }

  const addToCart = async () => {
    if (!dto) return
    setPending(true)
    try {
      const res = await addActivityToCart({ sessionId: dto.id, quantity: qty })
      if (!res.ok) {
        toast(res.error, 'error')
        if (res.code === 'UNAUTHORIZED') signIn()
        await load(dto.id)
        return
      }
      setCartStore(res.cart)
      onCartChange?.(res.cart)
      if (res.session) setDto(res.session)
      setAdded(true)
      toast('已保留名額並加入購物車，請於時限內完成結帳', 'success')
    } finally {
      setPending(false)
    }
  }

  const toggleAlert = async () => {
    if (!dto) return
    if (!user) return signIn()
    setPending(true)
    try {
      const res = await toggleSeatAlert(dto.id, !dto.watching)
      if (!res.ok) toast(res.error, 'error')
      else {
        setDto({ ...dto, watching: res.watching })
        toast(res.watching ? '有名額時會以 LINE 通知你（不保留名額）' : '已取消名額通知', 'success')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#191D1A]/55 animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col bg-[#F5F1E8] text-[#191D1A] shadow-pop outline-none',
            'inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(30rem,100vw)] sm:border-l sm:border-[#191D1A]/10',
          )}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#191D1A]/10 px-4 py-3 pt-safe">
            <DialogPrimitive.Title className="text-base font-bold">活動詳情</DialogPrimitive.Title>
            <DialogPrimitive.Close className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#EEE6FA]" aria-label="關閉">
              <X className="h-5 w-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            {error ? (
              <p className="p-6 text-sm">{error}</p>
            ) : !dto ? (
              <div className="space-y-3 p-4" aria-busy>
                <div className="aspect-video animate-pulse rounded-2xl bg-[#EEE6FA]" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-[#EEE6FA]" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-[#EEE6FA]" />
              </div>
            ) : (
              <PanelBody dto={dto} qty={qty} setQty={setQty} />
            )}
          </div>

          {dto && (
            <div className="border-t border-[#191D1A]/10 bg-white px-4 py-3 pb-safe">
              <Cta
                dto={dto}
                qty={qty}
                loggedIn={Boolean(user)}
                loggingIn={loggingIn}
                pending={pending}
                added={added}
                alertsEnabled={alertsEnabled}
                onSignIn={signIn}
                onAdd={addToCart}
                onToggleAlert={toggleAlert}
              />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PanelBody({ dto, qty, setQty }: { dto: ActivitySessionDTO; qty: number; setQty: (n: number) => void }) {
  const canPick = dto.state === 'OPEN' && dto.maxQuantity > 0 && dto.mine?.status !== 'CONFIRMED' && dto.mine?.status !== 'PENDING_PAYMENT'
  return (
    <div className="space-y-5 p-4">
      <div className="aspect-video overflow-hidden rounded-2xl bg-[#EEE6FA]">
        <ActivityCover cover={dto.cover} title={dto.title} typeLabel={dto.typeLabel} priority />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#30223D] px-2.5 py-0.5 text-xs font-bold text-white">{dto.typeLabel}</span>
          {dto.levelLabel && (
            <span className="rounded-full bg-[#EEE6FA] px-2.5 py-0.5 text-xs font-bold text-[#30223D]">{dto.levelLabel}</span>
          )}
          <SignupBadge state={dto.state} label={dto.stateLabel} />
        </div>
        <h2 className="mt-3 text-2xl font-extrabold leading-tight">{dto.title}</h2>
      </div>

      <dl className="grid gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-[#191D1A]/10">
        <Row icon={CalendarDays} label="日期">{dto.dateLabel}</Row>
        <Row icon={Clock} label="時間">{dto.timeLabel}</Row>
        <Row icon={MapPin} label="使用場地">{dto.courtNames.length > 0 ? dto.courtNames.join('、') : '依現場安排'}</Row>
        <Row icon={Users} label="名額">
          總名額 {dto.capacity} 人・
          <strong className={cn(dto.remaining === 0 && 'text-rose-700')}>剩餘 {dto.remaining} 位</strong>
        </Row>
      </dl>

      {(dto.requirements || dto.levelLabel) && (
        <section>
          <h3 className="text-sm font-bold">適合程度與參加條件</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#191D1A]/80">
            {[dto.levelLabel && `適合：${dto.levelLabel}`, dto.requirements].filter(Boolean).join('\n')}
          </p>
        </section>
      )}

      {(dto.description || dto.summary) && (
        <section>
          <h3 className="text-sm font-bold">活動介紹</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#191D1A]/80">{dto.description ?? dto.summary}</p>
        </section>
      )}

      <section className="rounded-2xl bg-[#EEE6FA] p-4">
        <h3 className="text-sm font-bold text-[#30223D]">費用</h3>
        <p className="mt-1 text-2xl font-extrabold text-[#30223D] tabular">
          {priceText(dto.price, dto.unitLabel)}
          {dto.price > 0 && <span className="ml-1 text-sm font-semibold">（每場）</span>}
        </p>
        {dto.seatsPerUnit > 1 && <p className="mt-1 text-xs text-[#30223D]/80">每組 {dto.seatsPerUnit} 人，佔 {dto.seatsPerUnit} 個名額</p>}
        {dto.includes && <p className="mt-2 text-sm text-[#30223D]/85">包含：{dto.includes}</p>}

        {canPick && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span id="qty-label" className="text-sm font-semibold text-[#30223D]">
              報名{dto.unitLabel === '人' ? '人數' : '組數'}
            </span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="qty-label">
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#30223D] ring-1 ring-[#30223D]/20 disabled:opacity-40"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                aria-label="減少"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <output className="w-8 text-center text-lg font-bold tabular" aria-live="polite">
                {qty}
              </output>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#30223D] ring-1 ring-[#30223D]/20 disabled:opacity-40"
                onClick={() => setQty(Math.min(dto.maxQuantity, qty + 1))}
                disabled={qty >= dto.maxQuantity}
                aria-label="增加"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {canPick && dto.price > 0 && (
          <p className="mt-3 flex items-baseline justify-between border-t border-[#30223D]/15 pt-3 text-sm text-[#30223D]">
            <span>
              小計（{qty} {dto.unitLabel} × NT${dto.price.toLocaleString()}）
            </span>
            <strong className="text-lg tabular">NT${(qty * dto.price).toLocaleString()}</strong>
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold">取消與退款規則</h3>
        <table className="mt-2 w-full text-sm">
          <tbody className="divide-y divide-[#191D1A]/10">
            {REFUND_POLICY_ROWS.map((r) => (
              <tr key={r.window}>
                <td className="py-1.5 text-[#191D1A]/75">{r.window}</td>
                <td className="py-1.5 text-right font-semibold">{r.ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed text-[#191D1A]/65">
          退款以點數回補至會員帳戶。場館取消場次時全額退款。
          {dto.refundNote && <span className="mt-1 block">{dto.refundNote}</span>}
        </p>
        <p className="mt-1 text-xs text-[#191D1A]/65">{dto.closesAtLabel}</p>
      </section>
    </div>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#6941A5]" aria-hidden />
      <dt className="w-16 shrink-0 text-[#191D1A]/60">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

function Cta(props: {
  dto: ActivitySessionDTO
  qty: number
  loggedIn: boolean
  loggingIn: boolean
  pending: boolean
  added: boolean
  alertsEnabled: boolean
  onSignIn: () => void
  onAdd: () => void
  onToggleAlert: () => void
}) {
  const { dto } = props
  const primary = 'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6941A5] text-base font-bold text-white transition-colors hover:bg-[#30223D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6941A5] disabled:cursor-not-allowed disabled:bg-[#191D1A]/25'
  const secondary = 'flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#30223D] text-base font-bold text-[#30223D] hover:bg-[#EEE6FA] disabled:opacity-50'
  const disabled = (text: string) => (
    <button type="button" disabled className={primary}>
      {text}
    </button>
  )

  if (dto.mine?.status === 'CONFIRMED') {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-emerald-800">✓ 你已報名這場（{dto.mine.quantity} {dto.unitLabel}）</p>
        <Link href="/bookings" className={secondary}>
          查看我的預約
        </Link>
      </div>
    )
  }
  if (dto.mine?.status === 'PENDING_PAYMENT') {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-amber-900">這場有待付款的訂單，名額保留到付款期限</p>
        {dto.mine.bookingId && (
          <Link href={`/checkout/${dto.mine.bookingId}`} className={primary}>
            前往付款
          </Link>
        )}
      </div>
    )
  }
  if (props.added || dto.mine?.status === 'IN_CART') {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-[#30223D]">
          已在購物車（{dto.mine?.quantity ?? props.qty} {dto.unitLabel}），名額暫留中，完成付款才算報名成功
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={secondary} onClick={props.onAdd} disabled={props.pending || dto.state !== 'OPEN'}>
            更新人數
          </button>
          <Link href="/cart" className={primary}>
            <ShoppingCart className="h-4 w-4" aria-hidden />
            前往結帳
          </Link>
        </div>
      </div>
    )
  }

  switch (dto.state) {
    case 'OPEN':
      if (!props.loggedIn) {
        return (
          <button type="button" className={primary} onClick={props.onSignIn} disabled={props.loggingIn}>
            {props.loggingIn ? '登入中…' : '登入後報名'}
          </button>
        )
      }
      return (
        <button type="button" className={primary} onClick={props.onAdd} disabled={props.pending || dto.maxQuantity < 1}>
          {props.pending ? '處理中…' : '報名這場活動'}
        </button>
      )
    case 'FULL':
      if (!props.alertsEnabled) {
        return (
          <div className="space-y-1">
            {disabled('已額滿')}
            <p className="text-center text-xs text-[#191D1A]/65">「有名額通知我」尚未開放</p>
          </div>
        )
      }
      return (
        <div className="space-y-1">
          <button type="button" className={secondary} onClick={props.onToggleAlert} disabled={props.pending}>
            {dto.watching ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
            {dto.watching ? '取消名額通知' : '有名額通知我'}
          </button>
          <p className="text-center text-xs text-[#191D1A]/65">通知不保留名額，收到通知後請盡快報名</p>
        </div>
      )
    case 'NOT_OPEN':
      return disabled(dto.opensAtLabel ?? '尚未開放報名')
    case 'CLOSED':
      return disabled('報名已截止')
    case 'IN_PROGRESS':
      return disabled('活動進行中')
    case 'ENDED':
      return disabled('活動已結束')
    case 'CANCELLED':
      return disabled('活動已取消')
  }
}
