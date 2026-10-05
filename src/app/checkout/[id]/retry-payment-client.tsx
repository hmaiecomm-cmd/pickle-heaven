'use client'

import * as React from 'react'
import Link from 'next/link'
import { CreditCard, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useHoldCountdown, formatCountdown } from '@/components/booking/cart-bar'
import { TapPayCardForm } from '@/components/checkout/tappay-card-form'
import { startPayment } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { cn, ntd } from '@/lib/utils'
import type { ChargeInstruction } from '@/lib/payments'

export function RetryPaymentClient({
  bookingId,
  code,
  status,
  total,
  playDate,
  expiresAt,
  items,
  providers,
}: {
  bookingId: string
  code: string
  status: string
  total: number
  playDate: string
  expiresAt: string | null
  items: { courtName: string; timeLabel: string; price: number }[]
  providers: { id: string; displayName: string; method: string }[]
}) {
  const { toast } = useToast()
  const [providerId, setProviderId] = React.useState(providers[0]?.id ?? 'mock')
  const [busy, setBusy] = React.useState(false)
  const [tappayConfig, setTappayConfig] = React.useState<Record<string, unknown> | null>(null)

  const remaining = useHoldCountdown(expiresAt)
  const expired = status !== 'PENDING' || (expiresAt !== null && remaining <= 0)

  const runInstruction = (instruction: ChargeInstruction) => {
    if (instruction.kind === 'redirect') {
      window.location.href = instruction.redirectUrl
      return
    }
    if (instruction.kind === 'form') {
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
    setTappayConfig(instruction.clientConfig)
  }

  const handlePay = async () => {
    setBusy(true)
    try {
      const res = await startPayment(bookingId, providerId)
      if (!res.ok) {
        toast(res.error, 'error')
        return
      }
      runInstruction(res.instruction)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-2">
      <h1 className="text-lg font-semibold tracking-tight">完成付款</h1>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>訂單編號</span>
            <span className="tabular">{code}</span>
          </div>
          <Separator />
          <p className="text-sm font-semibold">{formatDateFull(playDate)}</p>
          <ul className="space-y-1.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span>
                  {it.courtName} <span className="text-muted tabular">{it.timeLabel}</span>
                </span>
                <span className="tabular">{ntd(it.price)}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-medium">應付金額</span>
            <span className="text-2xl font-bold text-brand-600 tabular">{ntd(total)}</span>
          </div>
        </CardContent>
      </Card>

      {expired ? (
        <Card>
          <CardContent className="space-y-3 text-center">
            <p className="text-sm text-muted">這筆訂單的付款時間已過，時段已釋放給其他球友。</p>
            <Button asChild block>
              <Link href="/booking">重新預約</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
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
            </CardContent>
          </Card>

          {expiresAt && (
            <p className="text-center text-xs text-muted tabular">
              請於 {formatCountdown(remaining)} 內完成付款
            </p>
          )}

          <Button size="lg" block loading={busy} onClick={handlePay}>
            <Lock className="h-4 w-4" aria-hidden />
            確認付款 {ntd(total)}
          </Button>
        </>
      )}

      {tappayConfig && (
        <TapPayCardForm
          open
          config={tappayConfig}
          bookingId={bookingId}
          amount={total}
          onClose={() => setTappayConfig(null)}
        />
      )}
    </div>
  )
}
