import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { MembersClient } from './members-client'

export const metadata: Metadata = { title: '會員列表' }

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  return <MembersClient />
}
