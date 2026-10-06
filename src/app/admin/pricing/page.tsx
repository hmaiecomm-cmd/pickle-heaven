import type { Metadata } from 'next'
import { PricingClient } from './pricing-client'

export const metadata: Metadata = { title: '定價' }

export default function PricingPage() {
  return <PricingClient />
}
