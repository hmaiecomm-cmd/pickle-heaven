import type { Metadata } from 'next'
import { brand } from '@/config/site'
import { ShopClient } from './shop-client'

export const metadata: Metadata = {
  title: '商城',
  description: `${brand.name}商城 — 購買運動裝備與配件`,
}

export const dynamic = 'force-dynamic'

export default function ShopPage() {
  return <ShopClient />
}
