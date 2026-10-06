'use client'

import { PageHeader } from '@/components/layout'

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="AI 管理助理" 
        subtitle="Phase 1 開發中..."
      />
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center">
        <p className="text-muted">AI 管理助理 頁面 - 佔位符</p>
      </div>
    </div>
  )
}
