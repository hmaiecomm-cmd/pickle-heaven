import Link from 'next/link'
import { CalendarDays, Cctv, ChartNoAxesColumnIncreasing, CreditCard, Layers, UsersRound } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Hills } from '@/components/admin/brand'

export const dynamic = 'force-dynamic'

const GRID_ITEMS = [
  { id: 'courts', label: '場地與預約', href: '/admin/schedule', permission: 'courts' as const, icon: CalendarDays },
  { id: 'monitor', label: '即時監控', href: '/admin/monitor', permission: 'monitor' as const, icon: Cctv },
  { id: 'finance', label: '訂單與財務', href: '/admin/bookings', permission: 'bookings' as const, icon: CreditCard },
  { id: 'members', label: '會員與活動', href: '/admin/members', permission: 'members' as const, icon: UsersRound },
  { id: 'devices', label: '智慧設備管理', href: '/admin/devices', permission: 'settings' as const, icon: Layers },
  { id: 'overview', label: '營運總覽', href: '/admin/reports', permission: 'finance' as const, icon: ChartNoAxesColumnIncreasing },
]

export default async function AdminDashboard() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const availableItems = GRID_ITEMS.filter((item) => can(ctx.role, item.permission))

  return (
    <div className="relative">
      <Hills className="pointer-events-none fixed bottom-0 right-0 hidden h-28 w-[calc(100%-15rem)] md:block" />
      <nav aria-label="後台功能" className="relative grid grid-cols-2 gap-3 sm:gap-5 lg:h-[calc(100dvh-9rem)] lg:grid-cols-3 lg:grid-rows-2">
        {availableItems.map(({ id, label, href, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-[28px] border border-[#e6eadf] bg-white/95 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(31,77,52,0.12)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] sm:gap-5 lg:aspect-auto"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#eef7e6] to-[#dcefcf] transition-colors group-hover:from-[#e3f2d8] group-hover:to-[#cde7bb] sm:h-20 sm:w-20 lg:h-24 lg:w-24">
              <Icon className="h-8 w-8 text-[#2f7d3b] sm:h-10 sm:w-10 lg:h-12 lg:w-12" strokeWidth={1.7} aria-hidden />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[#1f2a22] sm:text-lg lg:text-xl">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
