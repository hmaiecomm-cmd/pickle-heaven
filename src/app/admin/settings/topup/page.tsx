import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { topUpAvailability } from '@/server/topup-service'
import { PlansClient } from './plans-client'

export const metadata: Metadata = { title: '儲值方案' }
export const dynamic = 'force-dynamic'

/** 儲值方案（擁有者）：支付金額、購買點數、贈送點數、使用範圍、效期、退款說明、上下架 */
export default async function TopUpPlansPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />
  const [plans, counts] = await Promise.all([
    prisma.topUpPlan.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { price: 'asc' }] }),
    prisma.topUpOrder.groupBy({ by: ['planId'], where: { status: 'CREDITED' }, _count: { _all: true } }),
  ])
  const sold = new Map(counts.map((c) => [c.planId, c._count._all]))
  const avail = topUpAvailability()
  return (
    <div className="space-y-4">
      <PageTitle title="儲值方案" desc="前台「儲值點數」只顯示上架中的方案。售價與點數分開設定，不假設 1 元 = 1 點；付費點數與贈送點數在帳本分開記錄。修改方案不影響已成立的儲值單。" />
      <p className={`rounded-xl px-3 py-2 text-sm ${avail.open ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
        {avail.open ? (avail.simulated ? '目前為測試環境：前台儲值使用模擬金流。' : '線上儲值已開放：前台可選擇方案付款。') : `前台目前顯示「線上儲值尚未開放」：${avail.reason}`}
      </p>
      <PlansClient
        plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price, points: p.points, bonusPoints: p.bonusPoints, scopeNote: p.scopeNote, validityNote: p.validityNote, refundNote: p.refundNote, active: p.active, sortOrder: p.sortOrder, sold: sold.get(p.id) ?? 0 }))}
      />
    </div>
  )
}
