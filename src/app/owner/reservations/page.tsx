import type { Metadata } from 'next'
import { ReservationsClient } from './reservations-client'

export const metadata: Metadata = { title: '預約管理' }

export default function ReservationsPage() {
  return <ReservationsClient />
}
