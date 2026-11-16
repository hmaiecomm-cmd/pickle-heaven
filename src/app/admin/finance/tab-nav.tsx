'use client'

import Link from 'next/link'

interface Tab {
  id: string
  label: string
  permission: string
  notOpen?: boolean
}

export function FinanceTabNav({ activeTab, tabs }: { activeTab: string; tabs: Tab[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 text-sm" aria-label="訂單與財務分頁">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/admin/finance?tab=${t.id}`}
          aria-current={activeTab === t.id ? 'page' : undefined}
          className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
            activeTab === t.id ? 'bg-white shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]'
          }`}
        >
          {t.label}
          {t.notOpen && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-400" title="未開放" />}
        </Link>
      ))}
    </nav>
  )
}
