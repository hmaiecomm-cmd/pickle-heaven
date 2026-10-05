import type { Metadata } from 'next'
import { getCart } from '@/lib/availability'
import { getCartToken } from '@/lib/session'
import { CartClient } from './cart-client'

export const metadata: Metadata = { title: '購物車' }
export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const cartToken = await getCartToken()
  const cart = await getCart(cartToken)
  return <CartClient initialCart={cart} />
}
