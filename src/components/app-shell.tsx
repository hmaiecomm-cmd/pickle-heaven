'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CircleUserRound, ShoppingCart, Ticket, Users } from 'lucide-react'
import { cn, ntd } from '@/lib/utils'
import { useCartCount } from '@/store/cart'
import { useLiff } from '@/components/liff-provider'
import { Button } from '@/components/ui/button'
import type { SessionUser } from '@/lib/types'

const NAV = [
  { href: '/booking', label: '場地預定', icon: CalendarDays },
  { href: '/sessions', label: '球敘', icon: Users },
  { href: '/cart', label: '購物車', icon: ShoppingCart },
  { href: '/bookings', label: '我的預約', icon: Ticket },
  { href: '/account', label: '帳戶', icon: CircleUserRound },
]

function Logo() {
  return (
    <Link href="/booking" className="flex items-center gap-2" aria-label="匹克精靈首頁">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        {/* 匹克球拍與球的簡化標記 */}
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <circle cx="9.5" cy="9" r="5.5" fill="currentColor" opacity=".9" />
          <path d="M7.4 13.6 4.6 19.4a1.4 1.4 0 0 0 1.9 1.9l5.8-2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="18" cy="16.5" r="3" fill="#d0e94a" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">匹克精靈</span>
    </Link>
  )
}

export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const cartCount = useCartCount()
  const { login, loggingIn } = useLiff()

  // 結帳與付款流程隱藏底部導覽，避免誤觸離開
  const hideNav = pathname.startsWith('/checkout')

  // 後台有自己的版型，不套用顧客端外框
  if (pathname.startsWith('/admin')) return <>{children}</>

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]/85 backdrop-blur pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />

          {/* 桌機導覽 */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-brand-700 dark:text-brand-300' : 'text-muted hover:text-[rgb(var(--fg))]',
                  )}
                >
                  {item.label}
                  {item.href === '/cart' && cartCount > 0 && (
                    <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/account" className="flex items-center gap-2">
                {user.points > 0 && (
                  <span className="hidden rounded-full surface-2 px-2.5 py-1 text-xs font-medium text-muted tabular sm:inline">
                    {ntd(user.points)} 點
                  </span>
                )}
                {user.pictureUrl ? (
                  // 使用者頭像來自 LINE CDN，直接以 img 呈現避免額外設定 next/image 網域
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.pictureUrl}
                    alt={user.displayName}
                    className="h-8 w-8 rounded-full border border-[rgb(var(--border))] object-cover"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full surface-2 text-xs font-semibold">
                    {user.displayName.slice(0, 1)}
                  </span>
                )}
              </Link>
            ) : (
              <Button size="sm" variant="line" onClick={login} loading={loggingIn}>
                LINE 登入
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 pt-4', hideNav ? 'pb-8' : 'pb-28 sm:pb-10')}>
        {children}
      </main>

      {/* 手機底部導覽 */}
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--border))] surface shadow-bar sm:hidden">
          <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-safe pt-1.5">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                      active ? 'text-brand-600' : 'text-muted',
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" aria-hidden />
                      {item.href === '/cart' && cartCount > 0 && (
                        <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white tabular">
                          {cartCount}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
