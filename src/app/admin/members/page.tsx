import type { Metadata } from 'next'
import { MembersClient } from './members-client'

export const metadata: Metadata = { title: '會員' }

export default function MembersPage() {
  return <MembersClient />
}
