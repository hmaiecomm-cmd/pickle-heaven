'use client'

import { Menu, Bell, User } from 'lucide-react'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] h-16">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        {/* Left - Menu Button (Mobile) */}
        <button onClick={onToggleSidebar} className="md:hidden p-2">
          <Menu className="h-5 w-5" />
        </button>

        {/* Center - Title (Mobile) or Venue Selector */}
        <div className="hidden md:flex items-center gap-4 flex-1">
          <div>
            <label className="text-xs font-medium text-muted">場館</label>
            <select className="mt-1 rounded border border-[rgb(var(--border))] bg-transparent px-2 py-1 text-sm">
              <option>Pickleball Paradise - 台北</option>
            </select>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-4">
          {/* Date Range Picker Placeholder */}
          <input
            type="date"
            className="hidden md:block rounded border border-[rgb(var(--border))] bg-transparent px-3 py-1.5 text-sm"
            defaultValue={new Date().toISOString().split('T')[0]}
          />

          {/* Notifications */}
          <button className="relative p-2 hover:surface-2 rounded">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* User Profile */}
          <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:surface-2">
            <div className="h-6 w-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
              O
            </div>
            <div className="hidden sm:block text-left text-xs">
              <p className="font-medium">擁有者</p>
              <p className="text-muted text-[10px]">Owner</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  )
}
