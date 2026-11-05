import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { canUseMockPayment } from '@/lib/payments'
import { getSessionUser } from '@/lib/session'
import { SimulatorClient } from './simulator-client'

export const metadata: Metadata = { title: '模擬付款' }
export const dynamic = 'force-dynamic'

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; code?: string; booking?: string; amount?: string; return?: string }>
}) {
  const user = await getSessionUser().catch(() => null)
  if (!canUseMockPayment(user?.id)) notFound()
  const sp = await searchParams
  return (
    <SimulatorClient
      providerRef={sp.ref ?? ''}
      bookingCode={sp.code ?? ''}
      bookingId={sp.booking ?? ''}
      amount={Number(sp.amount ?? 0)}
      returnPath={sp.return && sp.return.startsWith('http') ? new URL(sp.return).pathname + new URL(sp.return).search : null}
    />
  )
}
