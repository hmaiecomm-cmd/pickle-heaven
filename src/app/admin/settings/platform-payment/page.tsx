/**
 * 金流設定（平台訂閱）頁面
 */

import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden } from '@/components/admin/page-bits'
import { getPlatformPayments } from '@/lib/feature-service'
import PlatformPaymentClient from './platform-payment-client'

export default async function PlatformPaymentPage() {
  // 權限檢查：只有 SUPER_ADMIN 可以訪問
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return <Forbidden />

  // 獲取場館 ID
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
  if (!venue) return <div className="p-6">未找到場館</div>

  const payments = await getPlatformPayments(venue.id, 20)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">金流設定（平台訂閱）</h1>
        <p className="text-gray-500 mt-1">配置平台訂閱的金流提供商。此設定獨立於客戶交易金流。</p>
      </div>

      <PlatformPaymentClient initialPayments={payments} />
    </div>
  )
}
