'use client'

import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemberKpi } from './member-insights-types'

export function MemberKpiCard({ icon: Icon, label, value, kpi, format = 'number' }: { icon: LucideIcon; label: string; value: string | number; kpi: MemberKpi; format?: 'number' | 'percent' | 'currency' }) {
  const isPositive = kpi.change === null ? false : kpi.change >= 0
  const changeText = kpi.change === null ? '無前期' : `${isPositive ? '+' : ''}${kpi.change}%`

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-3 sm:p-4 shadow-sm">
      {/* 上方：icon + label */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-muted font-medium flex-1 min-w-0">{label}</p>
        <div className="flex h-10 w-10 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-[#eef7e6] shrink-0">
          <Icon className="h-5 w-5 text-[#2f7d3b]" aria-hidden />
        </div>
      </div>

      {/* 中方：數值 */}
      <p className="text-2xl sm:text-3xl font-bold text-[#1f2a22] mb-2">{value}</p>

      {/* 下方：趨勢 */}
      <div className="flex items-center gap-1">
        {kpi.change !== null && (
          <>
            {isPositive ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
            <span className={cn('text-xs sm:text-sm font-semibold', isPositive ? 'text-green-600' : 'text-red-600')}>{changeText}</span>
          </>
        )}
        {kpi.change === null && <span className="text-xs sm:text-sm text-muted">無前期資料</span>}
      </div>
    </div>
  )
}
