'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface AnomalyStats {
  period: { since: string; until: string; days: number }
  summary: {
    total: number
    resolved: number
    acknowledged: number
    pending: number
  }
  bySeverity: Array<{ severity: string; count: number; percentage: string }>
  byType: Array<{ type: string; count: number; percentage: string }>
  dailyTrend: Array<{ date: string; count: number }>
  topAffected: Array<{ circuitId: string; anomalyCount: number }>
  lastUpdated?: string
}

interface AnomalyDashboardProps {
  stats: AnomalyStats | null
  isLoading?: boolean
}

/**
 * 异常统计仪表板
 */
export function AnomalyDashboard({ stats, isLoading = false }: AnomalyDashboardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="space-y-3">
          <div className="h-8 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="grid gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-zinc-200" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-muted">
        无统计数据
      </div>
    )
  }

  const resolutionRate =
    stats.summary.total > 0
      ? ((stats.summary.resolved / stats.summary.total) * 100).toFixed(1)
      : 0

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">异常统计</h3>
            <p className="mt-1 text-xs text-muted">
              过去 {stats.period.days} 天 · 更新于 {new Date(stats.lastUpdated!).toLocaleTimeString('zh-TW')}
            </p>
          </div>
        </div>
      </div>

      {/* 摘要卡片 */}
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="总异常数"
          value={stats.summary.total}
          icon="⚠️"
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="待处理"
          value={stats.summary.pending}
          subtext={`${((stats.summary.pending / stats.summary.total) * 100 || 0).toFixed(0)}%`}
          icon="🔴"
          color="bg-red-50 text-red-700"
        />
        <StatCard
          label="已确认"
          value={stats.summary.acknowledged}
          icon="🟡"
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="已解决"
          value={stats.summary.resolved}
          subtext={`${resolutionRate}% 解决率`}
          icon="🟢"
          color="bg-green-50 text-green-700"
        />
      </div>

      {/* 严重程度分布 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold">按严重程度分布</h4>
        <div className="space-y-2">
          {stats.bySeverity.map((item) => (
            <div key={item.severity} className="flex items-center gap-3">
              <span className="min-w-16 text-xs font-medium">
                {item.severity === 'critical'
                  ? '严重'
                  : item.severity === 'error'
                    ? '异常'
                    : '警告'}
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn(
                    'h-6 rounded-full transition-all',
                    item.severity === 'critical'
                      ? 'bg-red-500'
                      : item.severity === 'error'
                        ? 'bg-orange-500'
                        : 'bg-amber-500'
                  )}
                  style={{ width: `${parseInt(item.percentage) || 0}%` }}
                />
              </div>
              <span className="min-w-12 text-right text-xs text-muted">
                {item.count} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 异常类型 TOP 10 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold">常见异常类型</h4>
        <div className="space-y-2">
          {stats.byType.map((item, idx) => (
            <div key={item.type} className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
                {idx + 1}
              </span>
              <span className="min-w-32 truncate text-xs font-medium">
                {item.type === 'controller_offline'
                  ? '控制器无回应'
                  : item.type === 'command_failed'
                    ? '指令执行失败'
                    : item.type === 'state_mismatch'
                      ? '状态不符'
                      : item.type === 'overload'
                        ? '电力过载'
                        : item.type === 'disconnected'
                          ? '设备断线'
                          : item.type === 'malfunction'
                            ? '设备故障'
                            : '排程执行失败'}
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-4 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${parseInt(item.percentage) || 0}%` }}
                />
              </div>
              <span className="min-w-12 text-right text-xs text-muted">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 受影响的迴路 */}
      {stats.topAffected.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold">受影响最多的迴路</h4>
          <div className="space-y-2">
            {stats.topAffected.map((item, idx) => (
              <div
                key={item.circuitId}
                className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                  {idx + 1}
                </span>
                <span className="font-mono text-sm font-semibold">迴路 {item.circuitId}</span>
                <span className="ml-auto text-xs font-medium text-zinc-600">
                  {item.anomalyCount} 个异常
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日期趋势（简化版） */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold">7 日趋势</h4>
        <div className="flex gap-1">
          {stats.dailyTrend.map((item) => {
            const maxCount = Math.max(...stats.dailyTrend.map((d) => d.count), 1)
            const height = (item.count / maxCount) * 60
            return (
              <div
                key={item.date}
                className="flex flex-1 flex-col items-center justify-end gap-1"
              >
                <div
                  className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                  style={{ height: `${height}px`, minHeight: '4px' }}
                  title={`${item.date}: ${item.count}`}
                />
                <span className="text-[10px] text-muted">
                  {new Date(item.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  subtext?: string
  icon?: string
  color?: string
}

function StatCard({ label, value, subtext, icon, color }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-zinc-200 p-3', color || 'bg-zinc-50')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-700">{label}</p>
          <p className="mt-1.5 text-2xl font-bold">{value}</p>
          {subtext && <p className="mt-1 text-xs text-zinc-600">{subtext}</p>}
        </div>
        <span className="text-xl">{icon}</span>
      </div>
    </div>
  )
}
