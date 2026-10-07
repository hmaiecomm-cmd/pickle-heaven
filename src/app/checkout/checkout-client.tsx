'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CreditCard, Lock, ShieldCheck, Tag } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { GoogleLoginButton } from '@/components/google-button'
import { useAuth } from '@/components/auth-provider'
import { useHoldCountdown, formatCountdown } from '@/components/booking/cart-bar'
import { TapPayCardForm } from '@/components/checkout/tappay-card-form'
import { useSetCart } from '@/store/cart'
import { previewQuote, startPayment, submitBooking } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { cn, ntd } from '@/lib/utils'
import type { CartDTO, SessionUser } from '@/lib/types'
import type { ChargeInstruction } from '@/lib/payments'
import { CartActivityItems } from '@/components/activities/cart-activity-items'

interface ProviderOption {
  id: string
  displayName: string
  method: string
}

export function CheckoutClient({
  initialCart,
  user,
  providers,
  refundRows,
}: {
  initialCart: CartDTO
  user: SessionUser | null
  providers: ProviderOption[]
  refundRows: { window: string; ratio: string }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { login } = useAuth()
  const setCartStore = useSetCart()

  const [cart] = React.useState(initialCart)
  const [name, setName] = React.useState(user?.displayName ?? '')
  const [phone, setPhone] = React.useState(user?.phone ?? '')
  const [note, setNote] = React.useState('')
  const [voucherInput, setVoucherInput] = React.useState('')
  const [appliedVoucher, setAppliedVoucher] = React.useState<string | null>(null)
  const [usePoints, setUsePoints] = React.useState(0)
  const [providerId, setProviderId] = React.useState(providers[0]?.id ?? 'mock')
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [quote, setQuote] = React.useState({
    subtotal: cart.subtotal,
    discount: 0,
    pointsUsed: 0,
    total: cart.subtotal,
  })

  // TapPay 需在頁面內收單，取得設定後才顯示卡片欄位
  const [tappayConfig, setTappayConfig] = React.useState<{ config: Record<string, unknown>; bookingId: string } | null>(
    null,
  )

  const remaining = useHoldCountdown(cart.expiresAt, () => {
    toast('保留時間已到，請重新選擇時段', 'error')
    router.push('/booking')
  })

  const recalc = React.useCallback(
    async (voucher: string | null, points: number) => {
      if (!user) return
      const res = await previewQuote(voucher, points)
      if (res.ok) {
        setQuote({
          subtotal: res.quote.subtotal,
          discount: res.quote.discount,
          pointsUsed: res.quote.pointsUsed,
          total: res.quote.total,
        })
        if (res.quote.voucherError) {
          setErrors((e) => ({ ...e, voucher: res.quote.voucherError as string }))
          setAppliedVoucher(null)
        } else {
          setErrors((e) => ({ ...e, voucher: '' }))
          setAppliedVoucher(res.quote.voucher?.code ?? null)
        }
      }
    },
    [user],
  )

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase()
    if (!code) return
    await recalc(code, usePoints)
  }

  const handlePointsChange = async (value: number) => {
    const capped = Math.max(0, Math.min(value, user?.points ?? 0, quote.subtotal - quote.discount))
    setUsePoints(capped)
    await recalc(appliedVoucher, capped)
  }

  /** 依金流回傳的指示完成付款 */
  const runInstruction = (instruction: ChargeInstruction, bookingId: string) => {
    if (instruction.kind === 'redirect') {
      window.location.href = instruction.redirectUrl
      return
    }

    if (instruction.kind === 'form') {
      // 金流商要求以 form POST 送出（例如藍新 MPG）
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = instruction.action
      for (const [key, value] of Object.entries(instruction.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      return
    }

    // TapPay：於本頁掛載卡片欄位收單
    setTappayConfig({ config: instruction.clientConfig, bookingId })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      login('/checkout')
      return
    }

    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = '請填寫聯絡人姓名'
    if (!/^09\d{8}$/.test(phone.replace(/[\s-]/g, ''))) nextErrors.phone = '請填寫正確的手機號碼（09 開頭共 10 碼）'
    setErrors((prev) => ({ ...prev, ...nextErrors }))
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const booking = await submitBooking({
        contactName: name.trim(),
        contactPhone: phone.trim(),
        note: note.trim() || undefined,
        voucherCode: appliedVoucher,
        usePoints,
      })

      if (!booking.ok) {
        toast(booking.error, 'error')
        if (booking.code === 'HOLD_EXPIRED' || booking.code === 'CART_EMPTY') router.push('/booking')
        return
      }

      setCartStore({ items: [], activityItems: [], subtotal: 0, expiresAt: null, invalidCount: 0 })

      // 全額折抵，無須付款
      if (booking.total === 0) {
        router.push(`/bookings/${booking.bookingId}?new=1`)
        return
      }

      const payment = await startPayment(booking.bookingId, providerId)
      if (!payment.ok) {
        toast(payment.error, 'error')
        router.push(`/checkout/${booking.bookingId}`)
        return
      }

      runInstruction(payment.instruction, booking.bookingId)
    } catch {
      toast('系統忙碌中，請稍後再試', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const groups = cart.items.reduce<Record<string, typeof cart.items>>((acc, item) => {
    ;(acc[item.date] ??= []).push(item)
    return acc
  }, {})

  const maxPoints = Math.min(user?.points ?? 0, quote.subtotal - quote.discount)

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link href="/cart" aria-label="返回購物車" className="-ml-2 rounded-lg p-2 text-muted hover:surface-2">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">結帳</h1>
        <span className="ml-auto text-xs text-muted tabular">
          保留剩餘 {remaining > 0 ? formatCountdown(remaining) : '0:00'}
        </span>
      </div>

      {/* 預約明細 */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">訂單明細</h2>
          <Separator />
          <CartActivityItems items={cart.activityItems ?? []} />
          {cart.items.length > 0 && <p className="text-xs font-bold text-muted">場地租借（每場地每時段計價）</p>}
          {Object.entries(groups).map(([date, items]) => (
            <div key={date} className="space-y-1.5">
              <p className="text-xs font-medium text-muted">{formatDateFull(date)}</p>
              {items.map((item) => (
                <div key={item.reservationId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    {item.courtName}
                    <span className="text-muted tabular">{item.timeLabel}</span>
                    <Badge variant={item.rateName === '尖峰' ? 'peak' : 'offpeak'}>{item.rateName}</Badge>
                  </span>
                  <span className="tabular">{ntd(item.price)}</span>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 聯絡資訊 */}
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-sm font-semibold">聯絡資訊</h2>
            <Field label="聯絡人姓名" required error={errors.name} htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="王小明"
                autoComplete="name"
              />
            </Field>
            <Field label="手機號碼" required error={errors.phone} htmlFor="phone" hint="用於到場核對與臨時聯絡">
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                autoComplete="tel"
                maxLength={15}
              />
            </Field>
            <Field label="備註" htmlFor="note" hint="選填，例如需要租借球拍">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="有其他需求請告訴我們"
                maxLength={200}
              />
            </Field>
          </CardContent>
        </Card>

        {/* 折抵 */}
        {user && (
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-sm font-semibold">折扣與點數</h2>

              <Field label="折價券代碼" error={errors.voucher || undefined}>
                <div className="flex gap-2">
                  <Input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    placeholder="輸入折價券代碼"
                    className="flex-1"
                    autoCapitalize="characters"
                  />
                  <Button type="button" variant="secondary" onClick={handleApplyVoucher}>
                    套用
                  </Button>
                </div>
              </Field>

              {appliedVoucher && (
                <p className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-300">
                  <Tag className="h-3.5 w-3.5" aria-hidden />
                  已套用 {appliedVoucher}，折抵 {ntd(quote.discount)}
                </p>
              )}

              {maxPoints > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>使用點數折抵</span>
                    <span className="text-xs text-muted tabular">可用 {user.points} 點</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={maxPoints}
                      step={10}
                      value={usePoints}
                      onChange={(e) => void handlePointsChange(Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[rgb(var(--border))] accent-brand-600"
                      aria-label="使用點數"
                    />
                    <span className="w-16 text-right text-sm font-medium tabular">−{ntd(usePoints)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 付款方式 */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold">付款方式</h2>
            <div className="space-y-2">
              {providers.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                    providerId === p.id
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-[rgb(var(--border))] hover:surface-2',
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={providerId === p.id}
                    onChange={() => setProviderId(p.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <CreditCard className="h-4 w-4 text-muted" aria-hidden />
                  <span className="text-sm font-medium">{p.displayName}</span>
                </label>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              信用卡資料由金流服務商以加密方式處理，本平台不會接觸或保存您的卡號與安全碼。
            </p>
          </CardContent>
        </Card>

        {/* 金額 */}
        <Card>
          <CardContent className="space-y-2 text-sm">
            <Row label="小計" value={ntd(quote.subtotal)} />
            {quote.discount > 0 && <Row label="折價券" value={`−${ntd(quote.discount)}`} accent />}
            {quote.pointsUsed > 0 && <Row label="點數折抵" value={`−${ntd(quote.pointsUsed)}`} accent />}
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium">應付金額</span>
              <span className="text-2xl font-bold text-brand-600 tabular">{ntd(quote.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 退款政策 */}
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold">取消與退款</h2>
            <Separator />
            <ul className="space-y-1 text-xs text-muted">
              {refundRows.map((row) => (
                <li key={row.window} className="flex items-center justify-between">
                  <span>{row.window}</span>
                  <span className="tabular">{row.ratio}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted">退款將以點數回補至您的帳戶，可於下次預約直接折抵。</p>
          </CardContent>
        </Card>

        {(cart.invalidCount ?? 0) > 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            購物車內有已開始或已超過預約截止時間的項目，無法付款。
            <Link href="/cart" className="ml-1 font-semibold underline underline-offset-2">回購物車移除</Link>
          </div>
        ) : user ? (
          <Button type="submit" size="lg" block loading={submitting} disabled={remaining <= 0}>
            <Lock className="h-4 w-4" aria-hidden />
            確認付款 {ntd(quote.total)}
          </Button>
        ) : (
          <GoogleLoginButton size="lg" next="/checkout" label="使用 Google 登入後結帳" />
        )}
      </form>

      {/* TapPay 卡片欄位（僅在選擇 TapPay 時出現） */}
      {tappayConfig && (
        <TapPayCardForm
          open
          config={tappayConfig.config}
          bookingId={tappayConfig.bookingId}
          amount={quote.total}
          onClose={() => setTappayConfig(null)}
        />
      )}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn('tabular', accent && 'text-brand-600')}>{value}</span>
    </div>
  )
}
