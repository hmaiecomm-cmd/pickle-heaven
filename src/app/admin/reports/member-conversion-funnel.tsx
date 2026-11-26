'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConversionFunnelStep } from './member-insights-types'
import { FUNNEL_EXPLANATION } from './member-insights-types'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

export function MemberConversionFunnel({ steps, title = '會員轉換漏斗', compact = true }: { steps: ConversionFunnelStep[]; title?: string; compact?: boolean }) {
  const [expanded, setExpanded] = React.useState(false)
  const displaySteps = expanded ? steps : steps.slice(0, 4)

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-[#1f2a22]">{title}</h3>
        {steps.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn('text-xs font-semibold text-[#2f7d3b] hover:text-[#1f4d34]', focusRing)}
          >
            {expanded ? '收合' : `展開全部 (${steps.length})`}
          </button>
        )}
      </div>

      {/* 簡潔版漏斗 */}
      <div className="space-y-2">
        {displaySteps.map((step, idx) => (
          <div key={step.step}>
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#2f7d3b] to-[#4a9d5e] p-3 sm:p-4 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate">{step.label}</p>
                  <p className="text-lg sm:text-2xl font-bold">{step.count.toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl sm:text-3xl font-bold">{step.percentage}%</p>
                  <p className="text-xs opacity-80">轉化率</p>
                </div>
              </div>
            </div>

            {/* 下一步箭頭 */}
            {idx < displaySteps.length - 1 && (
              <div className="flex justify-center py-1">
                <ChevronDown className="h-4 w-4 text-[#9ca89d]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 漏斗說明 */}
      <div className="mt-4 rounded-xl border border-[#e3e8dc] bg-[#fafbf8] p-3 sm:p-4">
        <h4 className="text-xs font-bold text-[#1f4d34] sm:text-sm">這張漏斗怎麼看？</h4>
        <p className="mt-2 text-xs leading-relaxed text-[#3d4a40] sm:text-sm">{FUNNEL_EXPLANATION}</p>
      </div>
    </div>
  )
}
