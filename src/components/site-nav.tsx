'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CircleUserRound, LogOut, Menu, ShieldCheck, ShoppingCart, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { brand, images } from '@/config/site'
import { useCartCount } from '@/store/cart'
import { currentPath, useAuth } from '@/components/auth-provider'
import { GoogleLoginButton } from '@/components/google-button'
import type { SessionUser } from '@/lib/types'

/** 右側選單的項目順序固定：場地預約、球敘、我的帳戶 */
const MENU = [
  { href: '/booking', label: '場地預約', icon: CalendarDays },
  { href: '/sessions', label: '球敘', icon: Users },
  { href: '/account', label: '我的帳戶', icon: CircleUserRound },
] as const

/**
 * 全站頂部導覽：左側正式 Logo 與場館名稱（回首頁），右側只有購物車與選單按鈕。
 * 導覽列底色沿用 logo 原檔的黑底，logo 不需要另外加框。
 * 首頁用 fixed 疊在主視覺上方；內頁用 sticky。
 */
export function SiteNav({ user, isAdmin = false, variant = 'inner' }: { user: SessionUser | null; isAdmin?: boolean; variant?: 'inner' | 'home' }) {
  const pathname = usePathname()
  const cartCount = useCartCount()
  const [open, setOpen] = React.useState(false)
  const toggleRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  // 換頁即關閉
  React.useEffect(() => setOpen(false), [pathname])

  const close = React.useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) toggleRef.current?.focus()
  }, [])

  // 開啟時：鎖背景捲動、焦點進入面板、Esc 關閉、Tab 在面板內循環
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []).filter((el) => el.offsetParent !== null)
    focusables()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const cartLabel = cartCount > 0 ? `購物車，${cartCount} 個項目` : '購物車'

  return (
    <>
      <header
        className={cn(
          'inset-x-0 top-0 z-50 bg-hp-logo text-white pt-safe',
          variant === 'home' ? 'fixed' : 'sticky border-b border-white/10',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 lg:h-[4.5rem]">
          <Link
            href="/"
            aria-label="返回首頁"
            title="返回首頁"
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Image
              src={images.logo.src}
              alt=""
              width={images.logo.width}
              height={images.logo.height}
              priority
              className="h-11 w-auto shrink-0 lg:h-12"
            />
            <span className="truncate text-[15px] font-bold tracking-wide sm:text-base">{brand.name}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/cart"
              aria-label={cartLabel}
              title="購物車"
              className="relative grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <ShoppingCart className="h-6 w-6" aria-hidden />
              {cartCount > 0 && (
                <span
                  className="absolute right-0.5 top-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-brand-500 px-1 text-[0.68rem] font-bold text-white tabular"
                  aria-hidden
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? '關閉選單' : '開啟選單'}
              title={open ? '關閉選單' : '開啟選單'}
              onClick={() => (open ? close() : setOpen(true))}
              className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-[#191D1A]/60" aria-hidden onClick={() => close()} />
          <div
            id="site-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="主選單"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-hp-deep text-white shadow-pop animate-slide-in pt-safe"
          >
            <div className="flex h-16 items-center justify-between px-4 lg:h-[4.5rem]">
              <span className="text-sm font-semibold text-white/70">選單</span>
              <button
                type="button"
                onClick={() => close()}
                aria-label="關閉選單"
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </div>

            <nav aria-label="主要導覽" className="flex-1 overflow-y-auto px-2">
              <ul>
                {MENU.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/account' && pathname.startsWith('/bookings'))
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-3.5 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                          active ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-t border-white/15 px-4 py-4 pb-safe">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="mb-3 flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  後台管理
                </Link>
              )}
              {user ? <UserBlock user={user} /> : <GoogleLoginButton next={currentPath()} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UserBlock({ user }: { user: SessionUser }) {
  const { logout } = useAuth()
  return (
    <div className="flex items-center gap-3">
      {user.pictureUrl ? (
        // 頭像來自 Google 或 LINE 的外部網址
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.pictureUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold">{user.displayName.slice(0, 1)}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.displayName}</p>
        <p className="text-xs text-white/60">已登入</p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex h-11 items-center gap-1.5 rounded-xl border border-white/30 px-3 text-sm font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        登出
      </button>
    </div>
  )
}
