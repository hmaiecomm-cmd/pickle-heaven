'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SiteNav } from '@/components/site-nav'
import type { SessionUser } from '@/lib/types'

/**
 * 顧客端外框：全站只有一條頂部導覽（Logo／購物車／選單），不再有底部分頁列。
 * 後台有自己的版型；首頁只疊上固定導覽，其餘版面由首頁自行排版。
 */
export function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) return <>{children}</>
  if (pathname === '/') {
    return (
      <>
        <SiteNav user={user} variant="home" />
        {children}
      </>
    )
  }

  const checkout = pathname.startsWith('/checkout')
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav user={user} />
      {user?.restricted && (
        <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          此帳戶目前限制使用，若有疑問請聯絡場館。
        </p>
      )}
      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 pt-4', checkout ? 'pb-8' : 'pb-12')}>{children}</main>
    </div>
  )
}
