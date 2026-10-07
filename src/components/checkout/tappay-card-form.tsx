'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ntd } from '@/lib/utils'

const TAPPAY_SDK_URL = 'https://js.tappaysdk.com/sdk/tpdirect/v5.19.2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const TPDirect: any

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && 'TPDirect' in window) return resolve()
    const script = document.createElement('script')
    script.src = TAPPAY_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('TapPay SDK 載入失敗'))
    document.head.appendChild(script)
  })
}

/**
 * TapPay Fields 收單表單。
 *
 * 卡號 / 到期日 / 安全碼三個欄位皆由 TapPay 以 iframe 注入，
 * 我方 JavaScript 無法讀取其內容，只會拿到一次性的 prime token，
 * 因此卡片資料不會經過本站伺服器，也不會寫入資料庫。
 */
export function TapPayCardForm({
  open,
  config,
  bookingId,
  amount,
  onClose,
}: {
  open: boolean
  config: Record<string, unknown>
  bookingId: string
  amount: number
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [ready, setReady] = React.useState(false)
  const [canPay, setCanPay] = React.useState(false)
  const [paying, setPaying] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false

    async function setup() {
      try {
        await loadSdk()
        if (cancelled) return

        TPDirect.setupSDK(config.appId, config.appKey, config.serverType)
        TPDirect.card.setup({
          fields: {
            number: { element: '#tappay-number', placeholder: '**** **** **** ****' },
            expirationDate: { element: '#tappay-expiry', placeholder: 'MM / YY' },
            ccv: { element: '#tappay-ccv', placeholder: '安全碼' },
          },
          styles: {
            input: { color: '#0e1726', 'font-size': '16px' },
            ':focus': { color: '#6941A5' },
            '.valid': { color: '#6941A5' },
            '.invalid': { color: '#dc2626' },
          },
        })

        TPDirect.card.onUpdate((update: { canGetPrime: boolean }) => {
          setCanPay(update.canGetPrime)
        })

        setReady(true)
      } catch (err) {
        console.error(err)
        toast('信用卡元件載入失敗，請確認網路後重試', 'error')
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [open, config, toast])

  const handlePay = () => {
    setPaying(true)
    TPDirect.card.getPrime(async (result: { status: number; card: { prime: string }; msg?: string }) => {
      if (result.status !== 0) {
        setPaying(false)
        toast(result.msg || '卡片資訊有誤，請確認後重試', 'error')
        return
      }

      try {
        const res = await fetch('/api/payments/tappay/prime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, prime: result.card.prime }),
        })
        const data = (await res.json()) as { ok: boolean; error?: string }

        if (data.ok) {
          router.push(`/bookings/${bookingId}?new=1`)
        } else {
          toast(data.error ?? '付款失敗，請重新嘗試', 'error')
          setPaying(false)
        }
      } catch {
        toast('連線異常，請稍後再試', 'error')
        setPaying(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title="信用卡付款" description={`應付金額 ${ntd(amount)}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">卡號</label>
            <div
              id="tappay-number"
              className="h-12 rounded-xl border border-[rgb(var(--border))] surface px-3.5 py-3.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">有效期限</label>
              <div
                id="tappay-expiry"
                className="h-12 rounded-xl border border-[rgb(var(--border))] surface px-3.5 py-3.5"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">安全碼</label>
              <div
                id="tappay-ccv"
                className="h-12 rounded-xl border border-[rgb(var(--border))] surface px-3.5 py-3.5"
              />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            卡片欄位由 TapPay 以獨立加密框架提供，本平台無法讀取您輸入的卡號與安全碼。
          </p>

          <Button block size="lg" onClick={handlePay} disabled={!ready || !canPay} loading={paying}>
            確認付款 {ntd(amount)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
