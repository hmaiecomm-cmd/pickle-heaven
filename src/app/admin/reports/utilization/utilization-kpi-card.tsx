'use client'
import type { KPIMetric } from './types'

export function UtilizationKpiCard({ label, value, metric }: { label: string; value: string | number; metric: KPIMetric }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-bold text-[#1f3d2b]">{value}</p>
    </div>
  )
}
