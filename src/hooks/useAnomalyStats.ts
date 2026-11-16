'use client'

import * as React from 'react'
import type { AnomalyStats } from '@/components/admin/anomaly-dashboard'

interface UseAnomalyStatsReturn {
  stats: AnomalyStats | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook：获取异常统计数据
 * @param days - 统计天数（默认 7）
 * @param circuitId - 可选特定迴路
 * @param autoRefreshMs - 自动刷新间隔（毫秒）
 */
export function useAnomalyStats(
  days: number = 7,
  circuitId?: string,
  autoRefreshMs: number = 60000 // 60 秒
): UseAnomalyStatsReturn {
  const [stats, setStats] = React.useState<AnomalyStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const url = new URL('/api/admin/devices/statistics', window.location.origin)
      url.searchParams.set('days', Math.min(days, 90).toString())
      if (circuitId) {
        url.searchParams.set('circuitId', circuitId)
      }

      const res = await fetch(url.toString())
      if (!res.ok) {
        throw new Error('无法获取统计数据')
      }

      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知错误'))
    } finally {
      setIsLoading(false)
    }
  }, [days, circuitId])

  // 初始加载和自动刷新
  React.useEffect(() => {
    refetch()

    if (autoRefreshMs <= 0) return

    const interval = setInterval(refetch, autoRefreshMs)
    return () => clearInterval(interval)
  }, [days, circuitId, autoRefreshMs, refetch])

  return { stats, isLoading, error, refetch }
}
