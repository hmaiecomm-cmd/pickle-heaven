import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { MemberOperationsNewDashboard } from '../member-operations-new-dashboard'

export const metadata: Metadata = { title: '會員經營與精準溝通' }
export const dynamic = 'force-dynamic'

export default async function MemberOperationsPage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <MemberOperationsNewDashboard />
}
