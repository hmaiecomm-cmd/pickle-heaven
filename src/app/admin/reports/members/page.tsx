import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { MemberOperationsDashboard } from '../member-operations-dashboard'

export const metadata: Metadata = { title: '會員經營與精準溝通' }
export const dynamic = 'force-dynamic'

export default async function MemberOperationsPage() {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  return <MemberOperationsDashboard initialTheme="off-peak-fill" initialRangeDays={30} venueOptions={[]} />
}
