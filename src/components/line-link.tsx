'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { linkLineAccount } from '@/server/account-actions'

/**
 * 舊 LINE 會員綁定：透過 LINE 官方登入驗證身分後，把舊帳號的訂單與點數搬到目前的 Google 帳號。
 * 這不是登入入口；只在已登入的帳戶頁出現，且需要 NEXT_PUBLIC_LIFF_ID 才會顯示。
 */
export function LineLinkButton({ linked }: { linked: boolean }) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)

  const complete = React.useCallback(
    async (idToken: string) => {
      const res = await linkLineAccount(idToken)
      if (!res.ok) return toast(res.error, 'error')
      toast(res.merged ? `已綁定並搬入舊帳號資料（${res.movedBookings} 筆訂單、${res.movedPoints} 點）` : '已綁定 LINE 身分', 'success')
      router.refresh()
    },
    [router, toast],
  )

  // 從 LINE 登入畫面回來時（網址帶 link=line）接續完成綁定
  React.useEffect(() => {
    if (!liffId || linked) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('link') !== 'line') return
    url.searchParams.delete('link')
    window.history.replaceState(null, '', url.toString())
    void (async () => {
      setBusy(true)
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })
        const idToken = liff.isLoggedIn() ? liff.getIDToken() : null
        if (idToken) await complete(idToken)
      } catch {
        toast('LINE 身分驗證失敗，請重試', 'error')
      } finally {
        setBusy(false)
      }
    })()
  }, [complete, liffId, linked, toast])

  if (!liffId) {
    return <p className="text-xs leading-relaxed text-muted">之前用 LINE 登入過的會員，舊帳號的預約、訂單與點數都保留著；目前尚未開放線上自助綁定，請到櫃台出示 LINE 帳號由工作人員協助合併。</p>
  }
  if (linked) return <p className="text-xs text-muted">已綁定 LINE 身分，預約通知可透過 LINE 送達。</p>

  const start = async () => {
    setBusy(true)
    try {
      const liff = (await import('@line/liff')).default
      await liff.init({ liffId })
      if (liff.isLoggedIn()) {
        const idToken = liff.getIDToken()
        if (idToken) return await complete(idToken)
      }
      const back = new URL(window.location.href)
      back.searchParams.set('link', 'line')
      liff.login({ redirectUri: back.toString() })
    } catch {
      toast('無法開啟 LINE 驗證，請稍後再試', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted">之前用 LINE 登入過？驗證 LINE 身分後，舊帳號的預約、訂單與點數會搬到這個帳號。</p>
      <Button variant="secondary" size="sm" onClick={start} loading={busy}>
        <Link2 className="h-4 w-4" aria-hidden />
        驗證 LINE 身分並綁定舊帳號
      </Button>
    </div>
  )
}
