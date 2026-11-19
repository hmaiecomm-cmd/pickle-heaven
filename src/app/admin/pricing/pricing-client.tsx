'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout'
import { CourtPricingTab } from './court-pricing'
import { MembershipPlansTab } from './membership-plans'
import { SeasonPassTab } from './season-pass'

type PricingTab = 'court' | 'membership' | 'seasonal'

export function PricingClient() {
  const [activeTab, setActiveTab] = useState<PricingTab>('court')

  const tabs: Array<{ id: PricingTab; label: string }> = [
    { id: 'court', label: '場地價格' },
    { id: 'membership', label: '會員方案' },
    { id: 'seasonal', label: '包季方案' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="價格與會員方案" subtitle="管理場地價格、會員儲值、包季方案" />

      {/* 分頁導覽 */}
      <div className="flex gap-2 border-b border-[rgb(var(--border))]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-none border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 分頁內容 */}
      <div>
        {activeTab === 'court' && <CourtPricingTab />}
        {activeTab === 'membership' && <MembershipPlansTab />}
        {activeTab === 'seasonal' && <SeasonPassTab />}
      </div>
    </div>
  )
}
