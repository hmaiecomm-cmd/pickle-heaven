'use client'

import * as React from 'react'
import { BellRing, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { LineMark } from '@/components/login-buttons'
import { lineOfficialAccount } from '@/config/site'
import { cn } from '@/lib/utils'

/**
 * 預約時提示 LINE 會員加入官方帳號好友，才收得到訂單推播。
 * - 只對以 LINE 登入的會員顯示（舊 Google 會員沒有 LINE userId，加好友也收不到推播）。
 * - 透過 LIFF 查好友狀態；已是好友就不再提示，回到頁面時重新確認。查不到狀態時照常顯示。
 * - 手機顯示「加入好友」按鈕；電腦另外顯示 QR Code 供手機掃描。
 */
export function LineFriendPrompt({ variant = 'full', className }: { variant?: 'full' | 'compact'; className?: string }) {
  const { user, lineFriendship } = useAuth()
  const viaLine = Boolean(user?.viaLine)
  const [friend, setFriend] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (!viaLine) return
    let cancelled = false
    const check = () => {
      void lineFriendship().then((v) => {
        if (!cancelled && v !== null) setFriend(v)
      })
    }
    check()
    // 會員去 LINE 加完好友回來時重新確認
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [viaLine, lineFriendship])

  if (!viaLine) return null

  if (friend) {
    if (variant === 'compact') return null
    return (
      <p className={cn('flex items-center gap-1.5 text-xs text-muted', className)}>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#06C755]" aria-hidden />
        已加入 LINE 好友，訂單通知會傳到您的 LINE。
      </p>
    )
  }

  const addButton = (
    <a
      href={lineOfficialAccount.addFriendUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#05B34C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06C755]/40"
    >
      <LineMark className="h-4 w-4" />
      加入好友
    </a>
  )

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-[#06C755]/30 bg-[#06C755]/5 px-4 py-3', className)}>
        <BellRing className="h-5 w-5 shrink-0 text-[#06C755]" aria-hidden />
        <p className="flex-1 text-xs leading-relaxed">
          <span className="font-semibold">加入 LINE 好友，接收預約通知與開打提醒</span>
          <span className="block text-muted">預約成功、前一天與開打前兩小時都會傳到您的 LINE。</span>
        </p>
        {addButton}
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-[#06C755]/30 bg-[#06C755]/5 p-4', className)}>
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="h-4 w-4 shrink-0 text-[#06C755]" aria-hidden />
            加入 LINE 好友，接收預約通知
          </p>
          <p className="text-xs leading-relaxed text-muted">
            加入「{lineOfficialAccount.name}」官方帳號（{lineOfficialAccount.basicId}）好友後，預約成功、前一天與開打前兩小時都會透過 LINE 通知您。
          </p>
          <div className="pt-1">{addButton}</div>
        </div>
        {/* 電腦上用手機掃描；手機本身無法掃自己的螢幕，所以只顯示按鈕 */}
        <figure className="hidden shrink-0 text-center sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lineOfficialAccount.qrImage}
            alt={`加入 ${lineOfficialAccount.name} LINE 好友的 QR Code`}
            width={112}
            height={112}
            className="h-28 w-28 rounded-lg bg-white p-1"
          />
          <figcaption className="mt-1 text-[11px] text-muted">用手機 LINE 掃描</figcaption>
        </figure>
      </div>
    </div>
  )
}
