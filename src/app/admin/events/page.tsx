import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { EventsClient } from './events-client'

export const metadata: Metadata = { title: '教練' }

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  return <EventsClient />
}
