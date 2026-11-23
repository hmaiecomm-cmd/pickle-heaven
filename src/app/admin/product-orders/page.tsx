import type { Metadata } from 'next'
import { Forbidden, NotOpen } from '@/components/admin/page-bits'
import { pagePermission } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: '商品訂單',
}

export const dynamic = 'force-dynamic'

export default async function ProductOrdersPage() {
  if ((await pagePermission('marketing')) === 'forbidden') return <Forbidden />
  return <NotOpen title="商品訂單" reason="商品訂單功能目前未開放。" />
}
