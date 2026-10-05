import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResultClient } from './result-client'

export const metadata: Metadata = { title: '付款結果' }
export const dynamic = 'force-dynamic'

/**
 * 金流商付款完成後的導回頁。
 *
 * 導回（使用者端）與 NotifyURL（伺服器端）可能有先後落差，
 * 因此此頁會持續輪詢訂單狀態，確認入帳後才導向預約詳情。
 */
export default async function CheckoutResultPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; transactionId?: string; orderId?: string }>
}) {
  const sp = await searchParams
  if (!sp.booking) redirect('/bookings')

  return <ResultClient bookingId={sp.booking} transactionId={sp.transactionId ?? null} />
}
