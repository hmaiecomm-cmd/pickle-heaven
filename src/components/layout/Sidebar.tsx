'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    title: '總覽',
    items: [{ label: '控制中心', href: '/owner/dashboard' }],
  },
  {
    title: '營運',
    items: [
      { label: '預約管理', href: '/owner/reservations' },
      { label: '活動與教練', href: '/owner/events' },
      { label: '會員', href: '/owner/members' },
      { label: '球場', href: '/owner/courts' },
      { label: '定價', href: '/owner/pricing' },
    ],
  },
  {
    title: '財務',
    items: [
      { label: '營收與財務', href: '/owner/finance' },
      { label: '付款狀態', href: '/owner/finance/payments' },
      { label: '發票', href: '/owner/invoices' },
      { label: '收據', href: '/owner/receipts' },
      { label: '費用', href: '/owner/expenses' },
      { label: '報表與分析', href: '/owner/reports' },
    ],
  },
  {
    title: 'AI 與智慧場館',
    items: [
      { label: 'AI 管理助理', href: '/owner/ai-assistant' },
      { label: 'AI 智慧球場', href: '/owner/smart-court' },
    ],
  },
  {
    title: '管理',
    items: [{ label: '設定', href: '/owner/settings' }],
  },
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-b border-[rgb(var(--border))] px-4 py-4">
        <Link href="/owner/dashboard" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            PP
          </span>
          <span className="hidden text-sm lg:inline">Pickleball Paradise</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="px-3 text-xs font-semibold uppercase text-muted">{group.title}</h3>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-brand-100 dark:bg-brand-900/30 font-medium text-brand-600 dark:text-brand-400' : 'text-muted hover:surface-2'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[rgb(var(--border))] p-4 text-center text-xs text-muted">
        <p>SYSTEM_MODE=MOCK</p>
      </div>
    </div>
  )
}
