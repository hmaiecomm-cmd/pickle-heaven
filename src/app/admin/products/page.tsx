import type { Metadata } from 'next'
import { ProductInventoryClient } from './product-inventory-client'

export const metadata: Metadata = {
  title: '商品庫存',
}

export const dynamic = 'force-dynamic'

export default function ProductInventoryPage() {
  return <ProductInventoryClient />
}
