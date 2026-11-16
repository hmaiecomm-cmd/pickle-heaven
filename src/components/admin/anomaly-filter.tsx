'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface AnomalyFilters {
  status?: 'pending' | 'acknowledged' | 'resolved'
  severity?: 'warning' | 'error' | 'critical'
  search?: string
}

interface AnomalyFilterProps {
  filters: AnomalyFilters
  onFiltersChange: (filters: AnomalyFilters) => void
  totalCount: number
  filteredCount: number
}

/**
 * 異常篩選工具
 */
export function AnomalyFilter({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: AnomalyFilterProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">篩選異常</h4>
        <span className="text-xs text-muted">
          顯示 {filteredCount} / {totalCount}
        </span>
      </div>

      <div className="space-y-2">
        {/* 狀態篩選 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-700">狀態</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'pending', label: '待處理', color: 'bg-amber-100 text-amber-700' },
              { value: 'acknowledged', label: '已確認', color: 'bg-blue-100 text-blue-700' },
              { value: 'resolved', label: '已解決', color: 'bg-green-100 text-green-700' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    status:
                      filters.status === (item.value as any) ? undefined : (item.value as any),
                  })
                }
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-medium transition-colors',
                  filters.status === item.value
                    ? item.color
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 嚴重程度篩選 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-700">嚴重程度</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'warning', label: '警告', color: 'bg-amber-100 text-amber-700' },
              { value: 'error', label: '異常', color: 'bg-red-100 text-red-700' },
              { value: 'critical', label: '嚴重', color: 'bg-red-200 text-red-800' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    severity:
                      filters.severity === (item.value as any)
                        ? undefined
                        : (item.value as any),
                  })
                }
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-medium transition-colors',
                  filters.severity === item.value
                    ? item.color
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 搜尋 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-700">搜尋</p>
          <input
            type="text"
            placeholder="異常類型、備註..."
            value={filters.search || ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                search: e.target.value || undefined,
              })
            }
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 清除篩選 */}
        {(filters.status || filters.severity || filters.search) && (
          <button
            onClick={() => onFiltersChange({})}
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            清除篩選
          </button>
        )}
      </div>
    </div>
  )
}
