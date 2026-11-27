'use client'
import React from 'react'
import { Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketingPlan } from './types'

interface MarketingPlansProps {
  plans: MarketingPlan[]
  demoMode?: boolean
  onRemoveDemo?: () => void
}

export function MarketingPlans({ plans, demoMode = false, onRemoveDemo }: MarketingPlansProps) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1f3d2b]">收益行銷方案</h2>
        {demoMode && (
          <button
            onClick={onRemoveDemo}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
            移除 Demo
          </button>
        )}
      </div>

      {/* 平板版可展開設計 */}
      <div className="hidden sm:block md:hidden mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50"
        >
          <span className="font-semibold text-[#1f2a22]">{expanded ? '隱藏方案' : '查看行銷方案'}</span>
          <span className={cn('transition-transform', expanded && 'rotate-180')}>▼</span>
        </button>
      </div>

      {/* 方案卡片 - 電腦版全顯示，平板版展開，手機版單列 */}
      <div className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        'hidden md:grid',
        'sm:block md:grid'
      )}>
        {!expanded && (
          <div className="sm:block md:hidden">
            {/* 平板版摘要 */}
            {plans.slice(0, 1).map((p) => (
              <div key={p.id} className="p-4 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
                <div className="flex items-center gap-2 mb-2">
                  {demoMode && <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded">DEMO</span>}
                  <h3 className="font-semibold text-[#1f2a22] flex-1">{p.name}</h3>
                </div>
                <p className="text-xs text-muted mb-3">{p.offer}</p>
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div>
                    <p className="text-muted">預估使用率提升</p>
                    <p className="font-bold text-[#2f7d3b]">+15%</p>
                  </div>
                  <div>
                    <p className="text-muted">預估增加營收</p>
                    <p className="font-bold text-green-600">NT${p.netRevenue}</p>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32]">
                  查看方案詳情
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(expanded || typeof window === 'undefined' || window.innerWidth >= 768) && plans.map((p) => (
          <div key={p.id} className="p-4 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2 mb-2">
              {demoMode && <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded whitespace-nowrap">DEMO</span>}
              <h3 className="font-semibold text-[#1f2a22]">{p.name}</h3>
            </div>

            <p className="text-xs text-muted mb-3">{p.offer}</p>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <p className="text-muted text-[11px]">預估使用率提升</p>
                <p className="font-bold text-[#2f7d3b] text-sm">+15%</p>
              </div>
              <div>
                <p className="text-muted text-[11px]">預估增加營收</p>
                <p className="font-bold text-green-600 text-sm">NT${p.netRevenue}</p>
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32]">
              查看方案詳情
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 手機版單列 */}
      <div className="sm:hidden space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="p-3 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-start gap-2 mb-2">
              {demoMode && <span className="px-2 py-1 text-[10px] font-bold bg-orange-100 text-orange-700 rounded whitespace-nowrap">DEMO</span>}
              <h3 className="font-semibold text-sm text-[#1f2a22] flex-1">{p.name}</h3>
            </div>

            <p className="text-xs text-muted mb-2">{p.offer}</p>

            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
              <div>
                <p className="text-muted">使用率</p>
                <p className="font-bold text-[#2f7d3b]">+15%</p>
              </div>
              <div>
                <p className="text-muted">營收</p>
                <p className="font-bold text-green-600">NT${p.netRevenue}</p>
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32]">
              查看詳情
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
