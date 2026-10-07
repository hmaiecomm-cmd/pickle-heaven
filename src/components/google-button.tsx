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
