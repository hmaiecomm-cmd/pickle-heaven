/**
 * Watchdog 監控 — 客戶端元件
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatDateTime } from '@/lib/time'

interface WatchdogAlert {
  id: string
  alertType: string
  severity: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR'
  title: string
  description?: string
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  detectionCount: number
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
}

interface WatchdogSummary {
  totalAlerts: number
  openAlerts: number
  highestSeverity: string
  recentAlerts: Array<{
    id: string
    title: string
    severity: string
    status: string
    createdAt: string
  }>
}

const SEVERITY_COLORS: Record<string, string> = {
  HEALTHY: 'bg-green-100 text-green-700',
  DEGRADED: 'bg-yellow-100 text-yellow-700',
  OFFLINE: 'bg-orange-100 text-orange-700',
  ERROR: 'bg-red-100 text-red-700',
}

export function WatchdogClient() {
  const [alerts, setAlerts] = useState<WatchdogAlert[]>([])
  const [summary, setSummary] = useState<WatchdogSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL'>('OPEN')

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/watchdog?venueId=venue-001&status=${filter}`)
      const data = await res.json()
      if (data.success) {
        setAlerts(data.data)
      }
    } catch (error) {
      console.error('查詢告警失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/watchdog?venueId=venue-001&action=summary')
      const data = await res.json()
      if (data.success) {
        setSummary(data.data)
      }
    } catch (error) {
      console.error('查詢摘要失敗:', error)
    }
  }, [])

  const handleAction = useCallback(
    async (alertId: string, action: 'acknowledge' | 'resolve', note?: string) => {
      try {
        const res = await fetch('/api/admin/watchdog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertId, action, note }),
        })
        const data = await res.json()
        if (data.success) {
          // 刷新列表
          await fetchAlerts()
          await fetchSummary()
        }
      } catch (error) {
        console.error('操作失敗:', error)
      }
    },
    [fetchAlerts, fetchSummary],
  )

  const runCheck = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/watchdog?venueId=venue-001&action=check')
      const data = await res.json()
      if (data.success) {
        // 刷新摘要和告警
        await fetchSummary()
        await fetchAlerts()
      }
    } catch (error) {
      console.error('執行檢測失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchAlerts, fetchSummary])

  useEffect(() => {
    fetchSummary()
    fetchAlerts()
  }, [])

  return (
    <div className="space-y-4">
      {/* 摘要卡片 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">總告警數</p>
            <p className="text-lg font-semibold">{summary.totalAlerts}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">開啟告警</p>
            <p className={`text-lg font-semibold ${summary.openAlerts > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {summary.openAlerts}
            </p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">最高嚴重程度</p>
            <p className="text-lg font-semibold">{summary.highestSeverity}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">最後檢測</p>
            <p className="text-xs text-muted">剛剛</p>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="space-x-2">
            {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded text-sm ${
                  filter === status
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {status === 'OPEN' ? '開啟' : status === 'ACKNOWLEDGED' ? '已確認' : status === 'RESOLVED' ? '已解決' : '全部'}
              </button>
            ))}
          </div>
          <button
            onClick={runCheck}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? '檢測中...' : '🔍 執行 Watchdog 檢測'}
          </button>
        </div>
      </div>

      {/* 告警列表 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">標題</th>
              <th className="text-left px-3 py-2">嚴重程度</th>
              <th className="text-left px-3 py-2">狀態</th>
              <th className="text-left px-3 py-2">檢測次數</th>
              <th className="text-left px-3 py-2">建立時間</th>
              <th className="text-left px-3 py-2">動作</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{alert.title}</div>
                  {alert.description && <div className="text-xs text-muted mt-1">{alert.description}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${SEVERITY_COLORS[alert.severity]}`}>
                    {alert.severity}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      alert.status === 'OPEN'
                        ? 'bg-red-100 text-red-700'
                        : alert.status === 'ACKNOWLEDGED'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {alert.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{alert.detectionCount} 次</td>
                <td className="px-3 py-2 text-xs text-muted">{formatDateTime(new Date(alert.createdAt))}</td>
                <td className="px-3 py-2">
                  {alert.status === 'OPEN' && (
                    <button
                      onClick={() => handleAction(alert.id, 'acknowledge', '已確認')}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      確認
                    </button>
                  )}
                  {alert.status === 'ACKNOWLEDGED' && (
                    <button
                      onClick={() => handleAction(alert.id, 'resolve', '已解決')}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      解決
                    </button>
                  )}
                  {alert.status === 'RESOLVED' && <span className="text-xs text-muted">已解決</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {alerts.length === 0 && (
          <div className="text-center py-6 text-muted">
            {filter === 'OPEN' ? '沒有開啟的告警 ✓' : `沒有${filter === 'ACKNOWLEDGED' ? '已確認' : '已解決'}的告警`}
          </div>
        )}
      </div>
    </div>
  )
}
