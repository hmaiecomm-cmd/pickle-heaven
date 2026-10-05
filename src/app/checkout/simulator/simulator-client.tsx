'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { ntd } from '@/lib/utils'

/**
 * 模擬金流付款頁。
 * 取代真實金流商的代管付款頁，讓完整流程（付款 → 回呼 → 訂單成立 → LINE 通知）
 * 在沒有金流帳號的情況下也能端到端驗證。
 */
export function SimulatorClient({
  providerRef,
  bookingCode,
  bookingId,
  amount,
}: {
  providerRef: string
  bookingCode: string
  bookingId: string
  amount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<'success' | 'fail' | null>(null)

  const pay = async (result: 'success' | 'fail') => {
    setBusy(result)
    try {
      await fetch('/api/payments/mock/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, ref: providerRef, code: bookingCode, amount }),
      })
    } catch {
      /* 忽略，交由結果頁判斷實際狀態 */
    }
    router.push(`/checkout/result?booking=${bookingId}`)
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
        這是開發用的模擬金流頁面，不會產生任何實際扣款。
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white">
              <CreditCard className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-base font-semibold">模擬信用卡付款</h1>
              <p className="text-xs text-muted">測試金流服務</p>
            </div>
          </div>

          <Separator />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">訂單編號</dt>
              <dd className="tabular">{bookingCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">交易序號</dt>
              <dd className="tabular text-xs">{providerRef}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-medium">應付金額</dt>
              <dd className="text-2xl font-bold text-brand-600 tabular">{ntd(amount)}</dd>
            </div>
          </dl>

          <Separator />

          <div className="space-y-2">
            <Button block size="lg" loading={busy === 'success'} onClick={() => pay('success')}>
              模擬付款成功
            </Button>
            <Button
              block
              variant="secondary"
              loading={busy === 'fail'}
              onClick={() => pay('fail')}
              className="text-red-600"
            >
              模擬付款失敗
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
