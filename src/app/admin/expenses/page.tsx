import type { Metadata } from 'next'
import { ExpensesClient } from './expenses-client'

export const metadata: Metadata = { title: '費用' }

export default function ExpensesPage() {
  return <ExpensesClient />
}
