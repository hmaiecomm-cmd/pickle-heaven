import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import type { Metadata } from 'next'
import { PricingClient } from './pricing-client'

export const metadata: Metadata = { title: '定價與會員折扣' }

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />
  return <PricingClient />
}
