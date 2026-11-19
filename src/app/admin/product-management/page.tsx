import type { Metadata } from 'next'
import { ProductManagementClient } from './product-management-client'

export const metadata: Metadata = {
  title: '商品與商城管理',
}

export const dynamic = 'force-dynamic'

export default function ProductManagementPage() {
  return <ProductManagementClient />
}
