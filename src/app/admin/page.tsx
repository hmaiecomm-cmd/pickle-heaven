import Link from 'next/link'
import { CalendarDays, Cctv, ChartNoAxesColumnIncreasing, CreditCard, Layers, UsersRound } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Hills } from '@/components/admin/brand'
import { AccessQuickCard } from './access-quick-card'
import { DoorMonitorCard } from './door-monitor-card'
import { getDoorRemoteState } from '@/server/door-remote'
import { listCameras } from '@/server/camera-service'

export const dynamic = 'force-dynamic'

const GRID_ITEMS = [
  { id: 'courts', label: '場地與預約', href: '/admin/schedule', permission: 'courts' as const, icon: CalendarDays },
  { id: 'monitor', label: '即時監控', href: '/admin/monitor', permission: 'monitor' as const, icon: Cctv },
  { id: 'finance', label: '訂單記錄', href: '/admin/bookings', permission: 'bookings' as const, icon: CreditCard },
  { id: 'members', label: '會員與教練', href: '/admin/members', permission: 'members' as const, icon: UsersRound },
  { id: 'devices', label: '智慧設備管理', href: '/admin/devices', permission: 'device' as const, icon: Layers },
  { id: 'overview', label: '營運與行銷', href: '/admin/reports', permission: 'finance' as const, icon: ChartNoAxesColumnIncreasing },
]

export default async function AdminDashboard() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const availableItems = GRID_ITEMS.filter((item) => can(ctx.role, item.permission))
  const canRemote = can(ctx.role, 'access.remote')
  const canMonitor = can(ctx.role, 'monitor')
  const hasAccessPermission = can(ctx.role, 'access')

  const [doorState, camerasData] = await Promise.all([
    hasAccessPermission ? getDoorRemoteState() : Promise.resolve(null),
    canMonitor ? listCameras(ctx.role).catch(() => ({ cameras: [] })) : Promise.resolve({ cameras: [] }),
  ])

  // 取得大門攝影機（預設為第一支攝影機）
  const doorCamera = camerasData.cameras?.[0] || null

  return (
    <div className="relative">
      <Hills className="pointer-events-none fixed bottom-0 right-0 hidden h-28 w-[calc(100%-15rem)] md:block" />
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
        {/* 六宮格：手機 2×3、平板 2×3 或 3×2、電腦 3×2 */}
        <nav aria-label="後台功能" className="relative grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 lg:gap-6">
          {availableItems.map(({ id, label, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-[20px] sm:rounded-[24px] md:rounded-[28px] border border-[#e6eadf] bg-white/95 shadow-[0_2px_10px_rgba(31,77,52,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(31,77,52,0.12)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] sm:gap-3 md:gap-4 lg:gap-5"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#eef7e6] to-[#dcefcf] transition-colors group-hover:from-[#e3f2d8] group-hover:to-[#cde7bb] sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24">
                <Icon className="h-6 w-6 text-[#2f7d3b] sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12" strokeWidth={1.7} aria-hidden />
              </span>
              <span className="text-xs font-bold tracking-tight text-[#1f2a22] text-center line-clamp-2 sm:text-sm md:text-base lg:text-lg">{label}</span>
            </Link>
          ))}
        </nav>

        {/* 門禁權限控制區 */}
        {doorState && hasAccessPermission && (
          <div>
            <AccessQuickCard doorState={doorState} canRemote={canRemote} />
          </div>
        )}

        {/* 大門監視器影像 */}
        {doorCamera && canMonitor && (
          <div>
            <DoorMonitorCard camera={doorCamera} canMonitor={true} />
          </div>
        )}
      </div>
    </div>
  )
}
