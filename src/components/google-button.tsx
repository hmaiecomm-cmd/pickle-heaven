'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'

/** Google 品牌標誌（官方四色 G） */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={cn('h-[18px] w-[18px] shrink-0', className)} aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

/**
 * 「使用 Google 登入」按鈕。
 * 未設定 Google 授權時改顯示說明，不會出現假的登入成功。
 */
export function GoogleLoginButton({
  next,
  label = '使用 Google 登入',
  className,
  size = 'md',
}: {
  /** 登入完成後要回到的站內路徑；預設為目前頁面 */
  next?: string
  label?: string
  className?: string
  size?: 'md' | 'lg'
}) {
  const { login, loggingIn, googleConfigured, unavailable } = useAuth()

  if (unavailable) {
    return (
      <button type="button" onClick={() => window.location.reload()} className={cn('rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5 text-center text-xs text-muted hover:surface-2', className)}>
        暫時無法確認登入狀態，點此重試
      </button>
    )
  }

  if (!googleConfigured) {
    return (
      <p className={cn('rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5 text-center text-xs text-muted', className)}>
        Google 登入尚未設定，請聯絡場館
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => login(next)}
      disabled={loggingIn}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#191D1A]/15 bg-white font-semibold text-[#191D1A] shadow-sm transition-colors hover:bg-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:opacity-60',
        size === 'lg' ? 'h-12 px-5 text-base' : 'h-11 px-4 text-[15px]',
        className,
      )}
    >
      <GoogleMark />
      {loggingIn ? '前往 Google…' : label}
    </button>
  )
}

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
  next?: string
  label?: string
  className?: string
  size?: 'md' | 'lg'
}) {
  const { loginLine, loggingIn } = useAuth()
  return (
    <button
      type="button"
      onClick={() => loginLine(next)}
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

/**
 * 登入按鈕組：LINE 與 Google 兩種方式。
 * LINE App 內建瀏覽器不支援 Google 登入，因此在 LINE 內只顯示 LINE 按鈕。
 */
export function LoginButtons({
  next,
  size = 'md',
  lineLabel,
  googleLabel,
  className,
}: {
  next?: string
  size?: 'md' | 'lg'
  lineLabel?: string
  googleLabel?: string
  className?: string
}) {
  const { googleConfigured, lineConfigured, inLineApp, unavailable } = useAuth()
  const showGoogle = googleConfigured && !inLineApp

  if (unavailable || (!lineConfigured && !showGoogle)) {
    // 交給 GoogleLoginButton 顯示「無法確認登入狀態」或「尚未設定」的說明
    return <GoogleLoginButton next={next} size={size} className={className} />
  }
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {lineConfigured && <LineLoginButton next={next} size={size} label={lineLabel} />}
      {showGoogle && <GoogleLoginButton next={next} size={size} label={googleLabel} />}
    </div>
  )
}
