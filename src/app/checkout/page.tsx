import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCart } from '@/lib/availability'
import { getCartToken, getSessionUser } from '@/lib/session'
import { checkoutProviders } from '@/lib/payments'
import { REFUND_POLICY_ROWS } from '@/lib/pricing'
import { CheckoutClient } from './checkout-client'

export const metadata: Metadata = { title: '結帳' }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const cartToken = await getCartToken()
  const cart = await getCart(cartToken)

  if (cart.items.length === 0 && cart.activityItems.length === 0) redirect('/cart')

  const user = await getSessionUser()
  const providers = checkoutProviders(user?.id)

  return (
    <CheckoutClient
      initialCart={cart}
      user={user}
      providers={providers}
      refundRows={REFUND_POLICY_ROWS}
    />
  )
}
