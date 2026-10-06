'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface NavItem {
  label: string
  href: string
  /** 只在路徑完全相同時視為選中（給 /admin 這種根路徑用） */
  exact?: boolean
  /** 資料來源仍為 mock，側欄標示提醒 */
  mock?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  groups: NavGroup[]
  brand: { href: string; label: string; short: string }
  footer?: ReactNode
  onNavigate?: () => void
}

export function Sidebar({ groups, brand, footer, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-b border-[rgb(var(--border))] px-4 py-4">
        <Link href={brand.href} onClick={onNavigate} className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            {brand.short}
          </span>
          <span className="text-sm">{brand.label}</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="px-3 text-xs font-semibold uppercase text-muted">{group.title}</h3>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item)
                        ? 'bg-brand-100 font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                        : 'text-muted hover:surface-2'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.mock && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        mock
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-t border-[rgb(var(--border))] p-4 text-center text-xs text-muted">{footer}</div>
      )}
    </div>
  )
}
