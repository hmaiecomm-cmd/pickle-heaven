'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

interface HeaderProps {
  onToggleSidebar: () => void
  right?: ReactNode
}

export function Header({ onToggleSidebar, right }: HeaderProps) {
  return (
    <header className="h-14 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))]">
      <div className="flex h-full items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <button onClick={onToggleSidebar} className="rounded p-2 hover:surface-2 md:hidden" aria-label="開啟選單">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block">
            <label className="text-[11px] font-medium text-muted">場館</label>
            <select className="block rounded border border-[rgb(var(--border))] bg-transparent px-2 py-0.5 text-sm">
              <option>Pickleball Paradise - 台北</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/booking" className="text-xs text-muted hover:text-brand-600">
            前台 →
          </Link>
          {right}
        </div>
      </div>
    </header>
  )
}
