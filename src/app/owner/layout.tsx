import type { Metadata } from 'next'
import { AppShell } from '@/components/layout'

export const metadata: Metadata = {
  title: { default: '控制中心', template: '%s | Pickleball Paradise Owner Portal' },
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
