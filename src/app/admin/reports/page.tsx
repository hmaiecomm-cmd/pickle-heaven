import type { Metadata } from 'next'
import { ReportsClient } from './reports-client'

export const metadata: Metadata = { title: '報表與分析' }

export default function ReportsPage() {
  return <ReportsClient />
}
