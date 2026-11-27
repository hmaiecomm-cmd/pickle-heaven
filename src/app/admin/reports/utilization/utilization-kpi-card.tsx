'use client'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIMetric } from './types'

export function UtilizationKpiCard({ label, value, metric }: { label: string; value: string | number; metric: KPIMetric }) {
  const hasChange = metric.change !== undefined && metric.change !== null
  const change = metric.change ?? 0
  const isPositive = hasChange && change >= 0

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 hover:shadow-sm transition-shadow">
      <p className="text-[11px] sm:text-xs text-muted truncate" title={label}>{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-bold text-lg sm:text-xl text-[#1f3d2b] truncate">{value}</p>
        {hasChange && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-semibold',
            isPositive ? 'text-emerald-600' : 'text-red-600'
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : change === 0 ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      {metric.label && (
        <p className="mt-1 text-[10px] text-muted">{metric.label}</p>
      )}
    </div>
  )
}
