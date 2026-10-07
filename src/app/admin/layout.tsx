import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin-auth'
import { ROLE_LABEL } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = {
  title: { default: '後台管理', template: '%s｜匹克精靈後台' },
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * 後台版面。每次請求都在伺服器端核對登入 session（登出、逾時、停用帳號即失效），
 * 不只依賴 middleware 的憑證簽章檢查。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext()
  const path = (await headers()).get('x-ph-path') ?? ''
  const isLogin = path === '/admin/login' || path.startsWith('/admin/login/')

  if (!ctx) {
    if (!isLogin) redirect('/admin/login')
    return <div className="min-h-dvh bg-[rgb(var(--bg))]">{children}</div>
  }

  // 首次登入或密碼被重設：先更換密碼，其他頁面一律導回
  const isChangePw = path === '/admin/change-password'
  if (ctx.mustChangePassword && !isChangePw) redirect('/admin/change-password')

  // 場館資料依登入者的資料範圍讀取（展示帳號只會讀到展示場館）
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })

  // 日期在伺服器端格式化，避免瀏覽器語系不同造成 hydration 不一致
  const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <AdminShell
      today={today}
      user={{
        username: ctx.username,
        displayName: ctx.displayName,
        roleLabel: ROLE_LABEL[ctx.role] ?? ctx.role,
        tenant: ctx.tenant,
        permissions: ctx.permissions,
      }}
      venue={venue ?? { id: 'none', name: '尚未建立場館' }}
    >
      {children}
    </AdminShell>
  )
}
