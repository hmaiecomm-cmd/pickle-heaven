'use client'

import { PageHeader } from '@/components/layout'

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="預約管理"
        subtitle="管理所有球場、活動和教練預約"
      />
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center">
        <p className="text-muted">預約管理頁面 - Phase 1C 開發中</p>
      </div>
    </div>
  )
}
