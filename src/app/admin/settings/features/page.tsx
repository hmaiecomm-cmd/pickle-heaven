/**
 * 功能開通管理頁面
 */

import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden } from '@/components/admin/page-bits'
import { getFeatureModules, getVenueSubscriptions } from '@/lib/feature-service'
import FeaturesClient from './features-client'

export default async function FeaturesPage() {
  // 權限檢查：只有 SUPER_ADMIN 可以訪問
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return <Forbidden />

  // 獲取場館 ID
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
  if (!venue) return <div className="p-6">未找到場館</div>

  const [modules, subscriptions] = await Promise.all([
    getFeatureModules(),
    getVenueSubscriptions(venue.id),
  ])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">功能開通管理</h1>
        <p className="text-gray-500 mt-1">管理場館的功能訂閱和授權狀態</p>
      </div>

      <FeaturesClient initialModules={modules} initialSubscriptions={subscriptions} />
    </div>
  )
}
