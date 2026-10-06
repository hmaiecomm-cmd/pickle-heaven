import type { Metadata } from 'next'
import { FinanceClient } from './finance-client'

export const metadata: Metadata = { title: '營收與財務' }

export default function FinancePage() {
  return <FinanceClient />
}
