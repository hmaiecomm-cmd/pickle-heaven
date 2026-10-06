'use client'

import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-dvh bg-[rgb(var(--bg))]">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block w-60 border-r border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))]">
        <Sidebar isOpen={true} onToggle={() => {}} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>

      {/* Sidebar - Mobile/Tablet */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-60 border-r border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] md:hidden">
          <Sidebar isOpen={true} onToggle={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Ask AI Button */}
      <button className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 md:h-14 md:w-14">
        ✨
      </button>
    </div>
  )
}
