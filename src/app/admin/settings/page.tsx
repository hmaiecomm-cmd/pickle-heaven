import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: '球館基本資料' }

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />
  return <SettingsClient />
}
