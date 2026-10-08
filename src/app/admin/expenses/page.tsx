import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden } from '@/components/admin/page-bits'
import { ExpensesClient } from './expenses-client'

export const metadata: Metadata = { title: '費用與收據' }
export const dynamic = 'force-dynamic'

/**
 * 費用與收據（支出憑證登錄與審核；不是對客戶開立銷售發票）。
 * 管理員與工作人員：只能新增、查看本人的申請。擁有者：查看全部、核准或退回。
 */
export default async function ExpensesPage() {
  const ctx = await pagePermission('expenses.own')
  if (ctx === 'forbidden') return <Forbidden />
  return <ExpensesClient review={can(ctx.role, 'expenses.review')} me={`admin:${ctx.username}`} displayName={ctx.displayName} />
}
