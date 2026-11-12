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
    <nav aria-label="後台功能" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:h-[calc(100dvh-8.5rem)] lg:grid-rows-2">
      {availableItems.map(({ id, label, href, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:gap-4 lg:aspect-auto"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 transition-colors group-hover:bg-emerald-100 sm:h-16 sm:w-16 lg:h-20 lg:w-20">
            <Icon className="h-7 w-7 text-emerald-600 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900 sm:text-base lg:text-lg">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
