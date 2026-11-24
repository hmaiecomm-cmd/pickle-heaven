'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
import { BRAND_NAME_EN, BRAND_NAME_ZH, BrandLogo, ForestSilhouette } from './brand'

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
import { AIChatWindow } from '@/components/ai/ai-chat-window'

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
  const search = useSearchParams().toString()
  React.useEffect(() => setDrawer(false), [pathname, search])

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
              <p className="truncate text-lg font-bold tracking-tight text-[#1f3d2b]">{BRAND_NAME_ZH}</p>
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
      <AIChatWindow />
    </div>
  )
}

function SidebarNav({ user }: { user: ShellUser }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const current = activeHref(pathname, search)
  const allowed = (p?: Permission) => !p || user.permissions.includes(p)
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items?.filter((i) => allowed(i.permission)) })).filter(
    (g) => (g.href ? allowed(g.permission) : (g.items?.length ?? 0) > 0),
  )
  const activeGroup = groups.find((g) => g.items?.some((i) => i.href === current)) || groups.find((g) => g.href === current)

  // 展開/收合狀態：使用 localStorage 保存使用者的手動設定，同時根據 URL 自動展開當前分類
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}')
    } catch {
      return {}
    }
  })

  // 當 activeGroup 變化時，自動展開當前分類（若未被手動收合）
  React.useEffect(() => {
    if (!activeGroup?.key || !activeGroup.items?.length) return
    setExpanded((prev) => {
      // 如果該分組沒有手動設定，則預設展開（表示自動展開）
      if (prev[activeGroup.key] === undefined) {
        return { ...prev, [activeGroup.key]: true }
      }
      return prev
    })
  }, [activeGroup?.key])

  const isOpen = (key: string) => {
    // 如果有子項目且當前分組在該組中，預設展開
    const hasItems = groups.find((g) => g.key === key)?.items?.length ?? 0 > 0
    if (!hasItems) return false
    // 使用者有明確設定時用使用者的設定，否則根據是否為當前分組判斷
    return expanded[key] ?? key === activeGroup?.key
  }

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !isOpen(key) }
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next))
      } catch {
        // localStorage 損壞時仍可正常使用
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col text-white">
      <Link
        href="/admin"
        aria-label={`${BRAND_NAME_ZH} 後台首頁`}
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className="flex items-center gap-3 px-4 py-4 hover:bg-white/5"
      >
        <BrandLogo showText={true} />
      </Link>

      <nav className="admin-sidebar-scroll flex-1 overflow-y-auto px-3 pb-3" aria-label="後台選單">
        <ul className="space-y-1">
          {/* 首頁 */}
          {groups.filter(g => !g.section).map((g) => {
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
            ) : null
          })}

          {/* 按 section 分組 */}
          {(['plus', 'pro', 'settings'] as const).map((section) => {
            const sectionGroups = groups.filter((g) => g.section === section)
            if (!sectionGroups.length) return null

            return (
              <React.Fragment key={section}>
                {/* Section 內的分組 */}
                {sectionGroups.map((g) => {
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
                          activeGroup?.key === g.key ? 'bg-white/10 text-white' : 'text-white/85',
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span>{g.label}</span>
                            {g.comingSoon && (
                              <span className="inline-flex items-center rounded-full bg-amber-100/40 px-2 py-0.5 text-[11px] font-medium text-amber-700">建立中</span>
                            )}
                          </div>
                          {g.subtitle && <div className="text-[11px] font-normal text-white/60">{g.subtitle}</div>}
                        </div>
                        <ChevronDown className={cn('h-4 w-4 text-white/50 transition-transform shrink-0', isOpen(g.key) && 'rotate-180')} aria-hidden />
                      </button>
                      {isOpen(g.key) && (
                        <ul className="mb-1 ml-5 mt-1 space-y-0.5 border-l border-white/15 pl-3">
                          {(() => {
                            const items = g.items!
                            const itemGroups = g.key === 'settings' ? [...new Set(items.map((i) => i.group))] : [undefined]
                            return itemGroups.flatMap((itemGroup) => {
                              const groupItems = g.key === 'settings' ? items.filter((i) => i.group === itemGroup) : items
                              return [
                                ...(itemGroup && g.key === 'settings' ? [<div key={`group-${itemGroup}`} className="mb-2 mt-3 pl-2 text-[11px] font-semibold text-white/50 uppercase tracking-wide">{itemGroup}</div>] : []),
                                ...groupItems.map((i) => (
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
                                      <div className="flex items-center gap-1">
                                        {i.comingSoon && <span className="rounded-full bg-amber-100/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">建立中</span>}
                                        {i.notOpen && <span className="rounded bg-white/15 px-1 text-[10px] text-white/70">未開放</span>}
                                      </div>
                                    </Link>
                                  </li>
                                )),
                              ]
                            })
                          })()}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </React.Fragment>
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
