'use client'

import Link from 'next/link'
import { CalendarCheck, Coins, Receipt, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountTab } from './tabs'

export const ACCOUNT_TABS: { key: AccountTab; label: string; icon: typeof CalendarCheck }[] = [
  { key: 'bookings', label: '我的預約', icon: CalendarCheck },
  { key: 'activities', label: '球敘／活動', icon: Users },
  { key: 'orders', label: '我的訂單', icon: Receipt },
  { key: 'points', label: '點數／票券', icon: Coins },
  { key: 'profile', label: '個人資料', icon: UserRound },
]

/** 帳戶頁分頁列：以連結切換（可分享、重新整理後保留），手機可橫向捲動 */
export function AccountTabs({ current, counts }: { current: AccountTab; counts?: Partial<Record<AccountTab, number>> }) {
  return (
    <nav aria-label="帳戶分頁" className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 rounded-xl surface-2 p-1" role="tablist">
        {ACCOUNT_TABS.map((t) => {
          const active = t.key === current
          const Icon = t.icon
          const n = counts?.[t.key]
          return (
            <li key={t.key} role="presentation">
              <Link
                href={`/account?tab=${t.key}`}
                role="tab"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all',
                  active ? 'surface text-brand-700 shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
                {typeof n === 'number' && n > 0 && (
                  <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular', active ? 'bg-brand-100 text-brand-700' : 'bg-[rgb(var(--border))] text-muted')}>{n}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
