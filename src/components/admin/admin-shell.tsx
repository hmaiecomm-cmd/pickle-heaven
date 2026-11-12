'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftToLine,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Cctv,
  CreditCard,
  House,
  Layers,
  LockKeyhole,
  LogOut,
  Menu,
  Settings,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Permission } from '@/lib/admin-permissions'
import { ADMIN_NAV, activeHref, type AdminNavIcon } from '@/app/admin/admin-nav'
import { ForestSilhouette, PaddleMark } from './brand'

const NAV_ICON: Record<AdminNavIcon, LucideIcon> = {
  home: House,
  courts: CalendarDays,
  monitor: Cctv,
  devices: Layers,
  access: LockKeyhole,
  orders: CreditCard,
  members: UsersRound,
  reports: ChartNoAxesColumnIncreasing,
  settings: Settings,
}
import { logoutAction } from '@/app/admin/login/actions'
import { AiProvider, useAi } from './ai-context'
import { AiChat, Avatar } from './ai-chat'

const OPEN_KEY = 'ph-admin-nav-open'

export interface ShellUser {
  username: string
  displayName: string
  roleLabel: string
  tenant: 'main' | 'demo'
  permissions: Permission[]
}

export function AdminShell({
  user,
  venue,
  today,
  children,
}: {
  user: ShellUser
  venue: { id: string; name: string }
  today: string
  children: React.ReactNode
}) {
  return (
    <AiProvider venue={venue} tenant={user.tenant}>
      <ShellInner user={user} venue={venue} today={today}>
        {children}
      </ShellInner>
    </AiProvider>
  )
}

function ShellInner({ user, venue, today, children }: { user: ShellUser; venue: { id: string; name: string }; today: string; children: React.ReactNode }) {
  const [drawer, setDrawer] = React.useState(false)
  const { open, setOpen } = useAi()
  const pathname = usePathname()
  React.useEffect(() => setDrawer(false), [pathname])

  return (
    <div className="flex h-dvh flex-col bg-[#f6f7f2]">
      {user.tenant === 'demo' && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-3 py-1 text-center text-xs font-bold text-amber-950" role="status">
          展示模式：目前為虛構的展示資料，所有付款、退款、發票、通知與設備操作都只產生模擬結果
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {/* 桌機側欄 */}
        <aside className="hidden w-60 shrink-0 bg-gradient-to-b from-[#1f4d34] to-[#163a27] md:block">
          <SidebarNav user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative flex h-16 shrink-0 items-center gap-3 overflow-hidden border-b border-[#e3e8dc] bg-white px-3 md:px-6">
            <ForestSilhouette className="pointer-events-none absolute bottom-0 right-24 hidden h-14 w-72 opacity-80 lg:block" />
            <button type="button" onClick={() => setDrawer(true)} className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-zinc-100 md:hidden" aria-label="開啟選單">
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-lg font-bold tracking-tight text-[#1f3d2b]">Pickle Heaven</p>
              <p className="truncate text-[11px] text-muted">
                {venue.name}・{today}
                {user.tenant === 'demo' ? '・展示場館' : ''}
              </p>
            </div>
            {user.permissions.includes('ai') && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className={cn('relative flex h-10 items-center gap-2 rounded-full border bg-white px-2 pr-3 text-sm font-medium transition-colors', open ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-zinc-300 hover:bg-zinc-50')}
                aria-pressed={open}
              >
                <Avatar size={26} />
                <span className="hidden sm:inline">詢問小P</span>
              </button>
            )}
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</div>
          </main>
        </div>

        {/* AI 面板：桌機在右側並排（不蓋住表格），手機全螢幕 */}
        {open && (
          <aside aria-label="小P AI 營運助理" className="fixed inset-0 z-50 flex flex-col md:relative md:inset-auto md:w-[380px] md:shrink-0 md:border-l md:border-[rgb(var(--border))]">
            <AiChat onClose={() => setOpen(false)} />
          </aside>
        )}
      </div>

      {/* 手機側欄 */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setDrawer(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-[#1f4d34] to-[#163a27] md:hidden">
            <button type="button" onClick={() => setDrawer(false)} className="absolute right-2 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="關閉選單">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarNav user={user} />
          </div>
        </>
      )}
    </div>
  )
}

function SidebarNav({ user }: { user: ShellUser }) {
  const pathname = usePathname()
  const current = activeHref(pathname)
  const allowed = (p?: Permission) => !p || user.permissions.includes(p)
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items?.filter((i) => allowed(i.permission)) })).filter(
    (g) => (g.href ? allowed(g.permission) : (g.items?.length ?? 0) > 0),
  )
  const activeGroup = groups.find((g) => g.items?.some((i) => i.href === current))?.key

  // 預設只展開目前所在分類；使用者手動展開／收合的狀態保留
  const [manual, setManual] = React.useState<Record<string, boolean>>({})
  React.useEffect(() => {
    try {
      setManual(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}'))
    } catch {}
  }, [])
  const isOpen = (key: string) => manual[key] ?? key === activeGroup
  const toggle = (key: string) => {
    const next = { ...manual, [key]: !isOpen(key) }
    setManual(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <div className="flex h-full flex-col text-white">
      <Link
        href="/admin"
        aria-label="Pickle Heaven 後台首頁"
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className="flex items-center gap-2.5 px-4 py-4 hover:bg-white/5"
      >
        <PaddleMark className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-[15px] font-bold leading-tight">Pickle Heaven</p>
          <p className="text-[11px] text-white/70">球館管理後台</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="後台選單">
        <ul className="space-y-1">
          {groups.map((g) => {
            const Icon = NAV_ICON[g.icon]
            return g.href ? (
              <li key={g.key}>
                <Link
                  href={g.href}
                  aria-current={current === g.href ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors',
                    current === g.href ? 'bg-[#7cb342] text-white shadow-sm' : 'text-white/85 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                  {g.label}
                </Link>
              </li>
            ) : (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={isOpen(g.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold transition-colors hover:bg-white/10',
                    activeGroup === g.key ? 'bg-white/10 text-white' : 'text-white/85',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden />
                  <span className="flex-1">{g.label}</span>
                  <ChevronDown className={cn('h-4 w-4 text-white/50 transition-transform', isOpen(g.key) && 'rotate-180')} aria-hidden />
                </button>
                {isOpen(g.key) && (
                  <ul className="mb-1 ml-5 mt-1 space-y-0.5 border-l border-white/15 pl-3">
                    {g.items!.map((i) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          aria-current={current === i.href ? 'page' : undefined}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                            current === i.href ? 'bg-[#7cb342] font-semibold text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                          )}
                        >
                          <span>{i.label}</span>
                          {i.notOpen && <span className="rounded bg-white/15 px-1 text-[10px] text-white/70">未開放</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-white/10 p-2">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeftToLine className="h-4 w-4" aria-hidden />
          返回前台
        </Link>
        <AccountMenu user={user} />
      </div>
    </div>
  )
}

function AccountMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#7cb342] text-xs font-bold text-white">{user.username.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{user.username}</span>
          <span className="block text-[11px] text-white/60">{user.roleLabel}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-white/50', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-zinc-200 bg-white p-1 text-zinc-900 shadow-lg">
          <p className="px-3 py-2 text-[11px] text-muted">{user.displayName}{user.tenant === 'demo' ? '・展示帳號' : ''}</p>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4" aria-hidden />
              登出
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
