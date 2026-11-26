'use client'

import { ChevronDown } from 'lucide-react'
import type { ConversionFunnelStep } from './member-insights-types'

export function MemberConversionFunnel({ steps, title = '會員轉換漏斗' }: { steps: ConversionFunnelStep[]; title?: string }) {
  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-5">
      <h3 className="text-lg font-bold text-[#1f2a22] mb-5">{title}</h3>
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.step}>
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#2f7d3b] to-[#4a9d5e] p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="text-2xl font-bold">{step.count.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{step.percentage}%</p>
                  <p className="text-xs opacity-80">轉化率</p>
                </div>
              </div>
              <div className="absolute right-0 top-0 h-full w-24 opacity-10">
                <div className="h-full w-full bg-gradient-to-r from-transparent to-white" />
              </div>
            </div>

            {/* 下一步箭頭 */}
            {idx < steps.length - 1 && (
              <div className="flex justify-center py-2">
                <ChevronDown className="h-5 w-5 text-[#9ca89d]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 關鍵指標摘要 */}
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#e3e8dc] pt-4 md:grid-cols-4">
        {steps.slice(0, 4).map((step) => (
          <div key={step.step} className="text-center">
            <p className="text-xs text-muted font-medium">{step.label}</p>
            <p className="mt-1 text-lg font-bold text-[#1f2a22]">{step.count.toLocaleString()}</p>
            <p className="text-xs text-[#2f7d3b]">-{100 - step.percentage}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
