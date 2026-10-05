'use client'

import { LogOut } from 'lucide-react'
import { logoutAction } from './login/actions'

export function AdminSignOut({ username }: { username: string }) {
  return (
    <form action={logoutAction} className="flex items-center gap-2">
      <span className="hidden text-xs text-muted sm:inline">{username}</span>
      <button
        type="submit"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--fg))]"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        登出
      </button>
    </form>
  )
}
