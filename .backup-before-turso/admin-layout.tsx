import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { default: '後台管理', template: '%s｜匹克天堂後台' },
  robots: { index: false, follow: false },
}

const NAV = [
  { href: '/admin', label: '總覽' },
  { href: '/admin/bookings', label: '訂單管理' },
  { href: '/admin/schedule', label: '場地時段' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[rgb(var(--bg))]">
      <header className="border-b border-[rgb(var(--border))] surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white">
              PH
            </span>
            匹克天堂後台
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--fg))]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/booking" className="ml-auto text-xs text-muted hover:text-brand-600">
            前台 →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
