'use client'

import * as React from 'react'
import type { AnomalyType, DeviceHealth } from '@/lib/device-health'

export interface DeviceAnomaly {
  id: string
  type: AnomalyType
  severity: 'warning' | 'error' | 'critical'
  status: 'pending' | 'acknowledged' | 'resolved'
  occurredAt: string
  lastReportedAt: string
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  notes: string | null
}

export interface UseDeviceAnomaliesReturn {
  anomalies: DeviceAnomaly[]
  health: DeviceHealth
  anomalyCount: number
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  acknowledge: (id: string, notes?: string) => Promise<void>
  resolve: (id: string, notes?: string) => Promise<void>
  isUpdating: boolean
}

/**
 * Hook：獲取和管理設備異常
 * @param circuitId - 迴路編號（如 "01"）
 * @param operatorEmail - 當前操作人郵件（用於操作記錄）
 * @param autoRefreshMs - 自動刷新間隔（毫秒，0 表示不自動刷新）
 */
export function useDeviceAnomalies(
  circuitId: string,
  operatorEmail: string = 'admin@example.com',
  autoRefreshMs: number = 10000
): UseDeviceAnomaliesReturn {
  const [anomalies, setAnomalies] = React.useState<DeviceAnomaly[]>([])
  const [health, setHealth] = React.useState<DeviceHealth>('healthy')
  const [anomalyCount, setAnomalyCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [isUpdating, setIsUpdating] = React.useState(false)

  const refetch = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/admin/devices/${circuitId}/anomalies`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '無法獲取異常列表')
      }

      const data = await res.json()
      if (data.success) {
        setAnomalies(data.data.anomalies)
        setHealth(data.data.health)
        setAnomalyCount(data.data.anomalyCount)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知錯誤'))
    } finally {
      setIsLoading(false)
    }
  }, [circuitId])

  const acknowledge = React.useCallback(
    async (id: string, notes?: string) => {
      try {
        setIsUpdating(true)
        setError(null)

        const res = await fetch(
          `/api/admin/devices/${circuitId}/anomalies/${id}/acknowledge`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              acknowledgedBy: operatorEmail,
              notes,
            }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '無法確認異常')
        }

        // 成功後刷新列表
        await refetch()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('未知錯誤'))
      } finally {
        setIsUpdating(false)
      }
    },
    [circuitId, operatorEmail, refetch]
  )

  const resolve = React.useCallback(
    async (id: string, notes?: string) => {
      try {
        setIsUpdating(true)
        setError(null)

        const res = await fetch(
          `/api/admin/devices/${circuitId}/anomalies/${id}/resolve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resolvedBy: operatorEmail,
              notes,
            }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '無法解決異常')
        }

        // 成功後刷新列表
        await refetch()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('未知錯誤'))
      } finally {
        setIsUpdating(false)
      }
    },
    [circuitId, operatorEmail, refetch]
  )

  // 初始加載和自動刷新
  React.useEffect(() => {
    refetch()

    if (autoRefreshMs <= 0) return

    const interval = setInterval(refetch, autoRefreshMs)
    return () => clearInterval(interval)
  }, [circuitId, autoRefreshMs, refetch])

  return {
    anomalies,
    health,
    anomalyCount,
    isLoading,
    error,
    refetch,
    acknowledge,
    resolve,
    isUpdating,
  }
}
