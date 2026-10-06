// Placeholder pages for Phase 1B - Quick Setup

import { PageHeader } from '@/components/layout'

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center">
        <p className="text-muted">{title} 頁面 - 開發中...</p>
      </div>
    </div>
  )
}

// 快速生成這些頁面：
