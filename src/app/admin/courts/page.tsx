import type { Metadata } from 'next'
import { CourtsClient } from './courts-client'

export const metadata: Metadata = { title: '球場' }

export default function CourtsPage() {
  return <CourtsClient />
}
