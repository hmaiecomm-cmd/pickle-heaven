import type { Metadata } from 'next'
import { PaymentsClient } from './payments-client'

export const metadata: Metadata = { title: '付款狀態' }

export default function PaymentsPage() {
  return <PaymentsClient />
}
