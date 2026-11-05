'use client'

import * as React from 'react'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'

/** LINE 品牌標誌（白色對話框） */
export function LineMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5 shrink-0', className)} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5C6.48 2.5 2 6.13 2 10.6c0 4 3.56 7.36 8.36 8 .33.07.77.22.88.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .87.55 1.08-.46 5.8-3.42 7.92-5.86C21.36 14 22 12.38 22 10.6 22 6.13 17.52 2.5 12 2.5Zm-5.4 10.7H4.62a.53.53 0 0 1-.53-.53V8.7a.53.53 0 1 1 1.06 0v3.44H6.6a.53.53 0 0 1 0 1.06Zm2.05-.53a.53.53 0 1 1-1.06 0V8.7a.53.53 0 1 1 1.06 0v3.97Zm4.77 0a.53.53 0 0 1-.95.32l-2.03-2.77v2.45a.53.53 0 1 1-1.06 0V8.7a.53.53 0 0 1 .95-.32l2.03 2.77V8.7a.53.53 0 1 1 1.06 0v3.97Zm3.2-2.51a.53.53 0 0 1 0 1.06h-1.45v.92h1.45a.53.53 0 0 1 0 1.06h-1.98a.53.53 0 0 1-.53-.53V8.7c0-.29.24-.53.53-.53h1.98a.53.53 0 0 1 0 1.06h-1.45v.93h1.45Z"
      />
    </svg>
  )
}

/** 「使用 LINE 登入」按鈕（LINE 品牌綠） */
export function LineLoginButton({
  next,
  label = '使用 LINE 登入',
  className,
  size = 'md',
}: {
  /** 登入完成後要回到的站內路徑；預設為目前頁面 */
  next?: string
  label?: string
  className?: string
  size?: 'md' | 'lg'
}) {
  const { login, loggingIn } = useAuth()
  return (
    <button
      type="button"
      onClick={() => login(next)}
      disabled={loggingIn}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#06C755] font-semibold text-white shadow-sm transition-colors hover:bg-[#05B34C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06C755]/40 disabled:opacity-60',
        size === 'lg' ? 'h-12 px-5 text-base' : 'h-11 px-4 text-[15px]',
        className,
      )}
    >
      <LineMark />
      {loggingIn ? '登入中…' : label}
    </button>
  )
}

/** 登入入口：只提供 LINE。無法確認登入狀態或尚未設定時改顯示說明，不會出現假的登入成功。 */
export function LoginButtons({
  next,
  size = 'md',
  label,
  className,
}: {
  next?: string
  size?: 'md' | 'lg'
  label?: string
  className?: string
}) {
  const { lineConfigured, unavailable } = useAuth()

  if (unavailable) {
    return (
      <button type="button" onClick={() => window.location.reload()} className={cn('rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5 text-center text-xs text-muted hover:surface-2', className)}>
        暫時無法確認登入狀態，點此重試
      </button>
    )
  }

  if (!lineConfigured) {
    return (
      <p className={cn('rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5 text-center text-xs text-muted', className)}>
        LINE 登入尚未設定，請聯絡場館
      </p>
    )
  }

  return <LineLoginButton next={next} size={size} label={label} className={className} />
}
