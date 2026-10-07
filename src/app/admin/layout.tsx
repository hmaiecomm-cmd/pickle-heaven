import type { Metadata } from 'next'
import { getAdminUser } from '@/lib/admin-auth'
import { AppShell } from '@/components/layout'
import type { NavGroup } from '@/components/layout/Sidebar'
import { AdminSignOut } from './sign-out'

export const metadata: Metadata = {
  title: { default: '後台管理', template: '%s｜匹克精靈後台' },
  robots: { index: false, follow: false },
}

/**
 * 後台導覽。標示 mock 的頁面資料來自 lib/mock-data，尚未接資料庫。
 * 存取保護在 src/middleware.ts。
 */
const NAV: NavGroup[] = [
  {
    title: '總覽',
    items: [
      { label: '今日總覽', href: '/admin', exact: true },
    ],
  },
  {
    title: '營運',
    items: [
      { label: '訂單管理', href: '/admin/bookings' },
      { label: '場地時段', href: '/admin/schedule' },
      { label: '球敘', href: '/admin/sessions' },
      { label: '球敘範本', href: '/admin/templates' },
      { label: '活動與教練', href: '/admin/events' },
      { label: '會員', href: '/admin/members' },
      { label: '球場', href: '/admin/courts' },
      { label: '定價', href: '/admin/pricing' },
    ],
  },
  {
    title: '財務',
    items: [
      { label: '營收與財務', href: '/admin/finance', exact: true },
      { label: '付款狀態', href: '/admin/finance/payments' },
      { label: '發票', href: '/admin/invoices' },
      { label: '收據', href: '/admin/receipts' },
      { label: '費用', href: '/admin/expenses' },
      { label: '報表與分析', href: '/admin/reports', mock: true },
    ],
  },
  {
    title: 'AI 與智慧場館',
    items: [
      { label: 'AI 智慧球場', href: '/admin/ai-courts' },
      { label: 'AI 管理助理', href: '/admin/ai-assistant' },
    ],
  },
  {
    title: '管理',
    items: [{ label: '設定', href: '/admin/settings' }],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()

  // 登入頁不套後台外框
  if (!admin) return <div className="min-h-dvh bg-[rgb(var(--bg))]">{children}</div>

  return (
    <AppShell
      nav={NAV}
      brand={{ href: '/admin', label: '匹克精靈後台', short: 'PH' }}
      headerRight={<AdminSignOut username={admin} />}
    >
      {children}
    </AppShell>
  )
}
