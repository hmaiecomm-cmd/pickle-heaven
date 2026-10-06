import type { Metadata } from 'next'
import { EventsClient } from './events-client'

export const metadata: Metadata = { title: '活動與教練' }

export default function EventsPage() {
  return <EventsClient />
}
