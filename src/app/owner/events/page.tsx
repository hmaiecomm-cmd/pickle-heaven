'use client'

import { PageHeader } from '@/components/layout'

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="活動與教練"
        subtitle="管理活動和教練課程"
      />
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center">
        <p className="text-muted">活動與教練頁面 - Phase 1E 開發中</p>
      </div>
    </div>
  )
}
