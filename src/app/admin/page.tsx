import Link from 'next/link'
import { CalendarDays, Cctv, ChartNoAxesColumnIncreasing, CreditCard, Layers, Lightbulb } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Hills } from '@/components/admin/brand'
import { AccessQuickCard } from './access-quick-card'
import { DoorMonitorCard } from './door-monitor-card'
import { getDoorRemoteState } from '@/server/door-remote'
import { listCameras } from '@/server/camera-service'
import { iotGatewayConfig } from '@/server/iot/gateway-client'
import { engineerVenues } from '@/server/iot/engineer'
import { EngineerToggle } from './engineer-toggle'

export const dynamic = 'force-dynamic'

const GRID_ITEMS = [
  { id: 'courts', label: '預約與訂單', href: '/admin/schedule', permission: 'courts' as const, icon: CalendarDays },
  { id: 'orders', label: '訂單紀錄', href: '/admin/bookings', permission: 'bookings' as const, icon: CreditCard },
  { id: 'operations', label: '無人營運管理', href: '/admin/devices', permission: 'device' as const, icon: Layers },
  { id: 'monitoring', label: 'AI 即時監控', href: '/admin/monitor', permission: 'monitor' as const, icon: Cctv },
  { id: 'assistant', label: 'AI 超級特助', href: '/admin/reports', permission: 'finance' as const, icon: ChartNoAxesColumnIncreasing },
  { id: 'ambience', label: 'AI 情境營造', href: '/admin/ambience', permission: 'device' as const, icon: Lightbulb },
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

  // 工程測試隱藏按鍵：有設備控制權限、Gateway 已設定、場館有場館代碼才出現
  const engineerVenue = can(ctx.role, 'device.control') && iotGatewayConfig() ? (await engineerVenues(ctx).catch(() => []))[0] ?? null : null

  // 取得大門攝影機（預設為第一支攝影機）
  const doorCamera = camerasData.cameras?.[0] || null

  return (
    <div className="relative">
      <Hills className="pointer-events-none fixed bottom-0 right-0 hidden h-28 w-[calc(100%-15rem)] md:block" />
      {engineerVenue && <EngineerToggle venueId={engineerVenue.id} target={engineerVenue.target} />}
      <div className="space-y-3 sm:space-y-3 lg:space-y-3">
        {/* 區塊 1：六宮格 3×2（桌面）/ 3×2（手機優先） */}
        <nav aria-label="後台功能" className="grid grid-cols-3 gap-2 sm:gap-2 md:gap-3 lg:grid-cols-3 lg:gap-4">
          {availableItems.map(({ id, label, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              className="group flex flex-col items-center justify-start gap-1 py-2 sm:py-2.5 md:py-3 lg:py-4 px-1 rounded-lg sm:rounded-xl border border-[#e6eadf] bg-white/95 shadow-[0_1px_3px_rgba(31,77,52,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(31,77,52,0.12)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#eef7e6] to-[#dcefcf] transition-colors group-hover:from-[#e3f2d8] group-hover:to-[#cde7bb] sm:h-11 sm:w-11 md:h-14 md:w-14 lg:h-16 lg:w-16">
                <Icon className="h-5 w-5 text-[#2f7d3b] sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" strokeWidth={1.7} aria-hidden />
              </span>
              <span className="text-xs font-bold tracking-tight text-[#1f2a22] text-center line-clamp-2 sm:text-xs md:text-sm lg:text-base leading-tight">{label}</span>
            </Link>
          ))}
        </nav>

        {/* 區塊 2：門禁控制 + 監視器（左右配置） */}
        {(doorState && hasAccessPermission) || (doorCamera && canMonitor) ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 items-start">
            {/* 左側：門禁控制（約 40%）*/}
            {doorState && hasAccessPermission && (
              <div className="md:col-span-2">
                <AccessQuickCard doorState={doorState} canRemote={canRemote} compact={true} />
              </div>
            )}

            {/* 右側：監視器（約 60%）*/}
            {doorCamera && canMonitor && (
              <div className="md:col-span-3">
                <DoorMonitorCard camera={doorCamera} canMonitor={true} compact={true} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
