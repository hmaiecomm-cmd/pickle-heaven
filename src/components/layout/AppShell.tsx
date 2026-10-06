'use client'

import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar, type NavGroup } from './Sidebar'

interface AppShellProps {
  nav: NavGroup[]
  brand: { href: string; label: string; short: string }
  /** 頁首右側內容，例如登入者與登出按鈕 */
  headerRight?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/** 後台外框：桌機固定側欄，手機以抽屜方式開合。 */
export function AppShell({ nav, brand, headerRight, footer, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-dvh bg-[rgb(var(--bg))]">
      {/* Sidebar - Desktop */}
      <div className="hidden w-60 border-r border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] md:block">
        <Sidebar groups={nav} brand={brand} footer={footer} />
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} right={headerRight} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>

      {/* Sidebar - Mobile drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-60 border-r border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] md:hidden">
            <Sidebar groups={nav} brand={brand} footer={footer} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
