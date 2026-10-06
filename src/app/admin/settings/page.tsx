import type { Metadata } from 'next'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: '設定' }

export default function SettingsPage() {
  return <SettingsClient />
}
