import type { Metadata } from 'next'
import { SimulatorClient } from './simulator-client'

export const metadata: Metadata = { title: '模擬付款' }
export const dynamic = 'force-dynamic'

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; code?: string; booking?: string; amount?: string }>
}) {
  const sp = await searchParams
  return (
    <SimulatorClient
      providerRef={sp.ref ?? ''}
      bookingCode={sp.code ?? ''}
      bookingId={sp.booking ?? ''}
      amount={Number(sp.amount ?? 0)}
    />
  )
}
