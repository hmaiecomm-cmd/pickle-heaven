'use client'

import { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  trend?: { value: number; direction: 'up' | 'down' }
  onClick?: () => void
  className?: string
}

export function KPICard({ label, value, unit, icon, trend, onClick, className }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4 hover:surface-2 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <p className="text-2xl font-bold tabular">{value}</p>
            {unit && <span className="text-sm text-muted">{unit}</span>}
          </div>
          {trend && (
            <p className={`mt-1.5 text-xs font-medium ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
    </div>
  )
}
