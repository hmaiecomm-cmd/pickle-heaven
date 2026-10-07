import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { CourtsClient } from './courts-client'

export const metadata: Metadata = { title: '場地與時段' }

export const dynamic = 'force-dynamic'

export default async function CourtsPage() {
  if ((await pagePermission('courts')) === 'forbidden') return <Forbidden />
  return <CourtsClient />
}
