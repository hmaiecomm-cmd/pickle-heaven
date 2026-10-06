import type { Metadata } from 'next'
import { ReceiptsClient } from './receipts-client'

export const metadata: Metadata = { title: '收據' }

export default function ReceiptsPage() {
  return <ReceiptsClient />
}
