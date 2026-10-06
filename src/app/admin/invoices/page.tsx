import type { Metadata } from 'next'
import { InvoicesClient } from './invoices-client'

export const metadata: Metadata = { title: '發票' }

export default function InvoicesPage() {
  return <InvoicesClient />
}
