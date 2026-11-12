import Link from 'next/link'
import { Calendar, Camera, CreditCard, Users, Zap, TrendingUp } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'

export const dynamic = 'force-dynamic'

const GRID_ITEMS = [
  {
    id: 'courts',
    label: '場地與預約',
    href: '/admin/schedule',
    permission: 'courts' as const,
    icon: Calendar,
  },
  {
    id: 'monitor',
    label: '即時監控',
    href: '/admin/monitor',
    permission: 'monitor' as const,
    icon: Camera,
  },
  {
    id: 'finance',
    label: '訂單與財務',
    href: '/admin/bookings',
    permission: 'bookings' as const,
    icon: CreditCard,
  },
  {
    id: 'members',
    label: '會員與活動',
    href: '/admin/members',
    permission: 'members' as const,
    icon: Users,
  },
  {
    id: 'devices',
    label: '智慧設備管理',
    href: '/admin/devices',
    permission: 'settings' as const,
    icon: Zap,
  },
  {
    id: 'overview',
    label: '營運總覽',
    href: '/admin/reports',
    permission: 'finance' as const,
    icon: TrendingUp,
  },
]

export default async function AdminDashboard() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  // 過濾有權限的項目
  const availableItems = GRID_ITEMS.filter(item => can(ctx.role, item.permission))

  return (
    <div className="flex flex-col">
      {/* 六宮格導航 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
        {availableItems.map(({ id, label, href, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            className="group relative flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white px-6 py-8 transition-all hover:shadow-md hover:border-zinc-300 active:scale-95"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 group-hover:from-green-200 group-hover:to-emerald-200 transition-colors">
              <Icon className="h-8 w-8 text-emerald-700" aria-hidden />
            </div>
            <span className="text-center font-semibold text-zinc-900">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
