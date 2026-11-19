import type { Metadata } from 'next'
import { ProductOrdersClient } from './product-orders-client'

export const metadata: Metadata = {
  title: '客戶訂單',
}

export const dynamic = 'force-dynamic'

export default function ProductOrdersPage() {
  return <ProductOrdersClient />
}
