'use client'

import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemberKpi } from './member-insights-types'

export function MemberKpiCard({ icon: Icon, label, value, kpi, format = 'number' }: { icon: LucideIcon; label: string; value: string | number; kpi: MemberKpi; format?: 'number' | 'percent' | 'currency' }) {
  const isPositive = kpi.change === null ? false : kpi.change >= 0
  const changeText = kpi.change === null ? '無前期' : `${isPositive ? '+' : ''}${kpi.change}%`

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-muted font-medium">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#1f2a22]">{value}</p>
          <div className="mt-2 flex items-center gap-1">
            {kpi.change !== null && (
              <>
                {isPositive ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className={cn('text-sm font-semibold', isPositive ? 'text-green-600' : 'text-red-600')}>{changeText}</span>
              </>
            )}
            {kpi.change === null && <span className="text-sm text-muted">無前期資料</span>}
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef7e6]">
          <Icon className="h-6 w-6 text-[#2f7d3b]" aria-hidden />
        </div>
      </div>
    </div>
  )
}
