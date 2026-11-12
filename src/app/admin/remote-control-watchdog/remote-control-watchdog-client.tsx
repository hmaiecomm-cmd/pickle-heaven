/**
 * Remote Control Watchdog — 客戶端監控 UI
 *
 * 功能：
 * - 顯示 Remote Control 連線狀態
 * - 手動觸發重連
 * - 查看重連嘗試歷史
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatDateTime } from '@/lib/time'

interface RemoteControlDevice {
  deviceId: string
  status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR'
  lastHeartbeat: string
  reconnectAttempts: number
}

interface RemoteControlWatchdogSummary {
  totalDevices: number
  connectedDevices: number
  disconnectedDevices: number
  reconnectingDevices: number
  errorDevices: number
  devices: RemoteControlDevice[]
}

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: 'bg-green-100 text-green-700',
  DISCONNECTED: 'bg-red-100 text-red-700',
  RECONNECTING: 'bg-yellow-100 text-yellow-700',
  ERROR: 'bg-orange-100 text-orange-700',
}

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: '已連接',
  DISCONNECTED: '已斷訊',
  RECONNECTING: '重連中',
  ERROR: '錯誤',
}

export function RemoteControlWatchdogClient() {
  const [summary, setSummary] = useState<RemoteControlWatchdogSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [reconnectingDevices, setReconnectingDevices] = useState<Set<string>>(new Set())
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/remote-control/watchdog?action=summary')
      const data = await res.json()
      if (data.success) {
        setSummary(data.data)
        setLastChecked(new Date())
      }
    } catch (error) {
      console.error('查詢摘要失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleManualReconnect = useCallback(
    async (deviceId: string) => {
      setReconnectingDevices((prev) => new Set(prev).add(deviceId))

      try {
        const res = await fetch('/api/remote-control/watchdog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reconnect',
            deviceId,
            clientId: `client-${deviceId}`,
          }),
        })

        const data = await res.json()
        if (data.success) {
          // 等待 2 秒後重新載入狀態
          setTimeout(() => {
            fetchSummary()
          }, 2000)
        }
      } catch (error) {
        console.error('重連失敗:', error)
      } finally {
        setReconnectingDevices((prev) => {
          const next = new Set(prev)
          next.delete(deviceId)
          return next
        })
      }
    },
    [fetchSummary],
  )

  const runCheck = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/remote-control/watchdog?action=check')
      const data = await res.json()
      if (data.success) {
        // 檢測完成後重新載入摘要
        await fetchSummary()
      }
    } catch (error) {
      console.error('執行檢測失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchSummary])

  useEffect(() => {
    fetchSummary()
    // 每 30 秒自動檢查一次
    const interval = setInterval(fetchSummary, 30000)
    return () => clearInterval(interval)
  }, [fetchSummary])

  return (
    <div className="space-y-4">
      {/* 摘要卡片 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">總設備數</p>
            <p className="text-lg font-semibold">{summary.totalDevices}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">已連接</p>
            <p className="text-lg font-semibold text-green-600">{summary.connectedDevices}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">已斷訊</p>
            <p className="text-lg font-semibold text-red-600">{summary.disconnectedDevices}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">重連中</p>
            <p className="text-lg font-semibold text-yellow-600">{summary.reconnectingDevices}</p>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <p className="text-xs text-muted">錯誤</p>
            <p className="text-lg font-semibold text-orange-600">{summary.errorDevices}</p>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {lastChecked && `最後檢測: ${formatDateTime(lastChecked)}`}
          </div>
          <div className="space-x-2">
            <button
              onClick={runCheck}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? '檢測中...' : '🔍 手動檢測'}
            </button>
          </div>
        </div>
      </div>

      {/* 設備列表 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">設備 ID</th>
              <th className="text-left px-3 py-2">狀態</th>
              <th className="text-left px-3 py-2">最後心跳</th>
              <th className="text-left px-3 py-2">重連嘗試</th>
              <th className="text-left px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {summary?.devices && summary.devices.length > 0 ? (
              summary.devices.map((device) => (
                <tr key={device.deviceId} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{device.deviceId.slice(0, 16)}...</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[device.status]}`}>
                      {STATUS_LABELS[device.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {device.lastHeartbeat ? formatDateTime(new Date(device.lastHeartbeat)) : '無'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        device.reconnectAttempts > 5
                          ? 'text-red-600 font-semibold'
                          : device.reconnectAttempts > 0
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }
                    >
                      {device.reconnectAttempts} 次
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {device.status !== 'CONNECTED' && (
                      <button
                        onClick={() => handleManualReconnect(device.deviceId)}
                        disabled={reconnectingDevices.has(device.deviceId)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500"
                      >
                        {reconnectingDevices.has(device.deviceId) ? '重連中...' : '手動重連'}
                      </button>
                    )}
                    {device.status === 'CONNECTED' && <span className="text-xs text-green-600">✓ 正常</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-6 text-muted">
                  沒有 Remote Control 設備
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 說明 */}
      <div className="border rounded-lg p-4 bg-blue-50 text-sm text-blue-700">
        <p className="font-semibold mb-2">💡 Remote Control Watchdog 說明：</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>每 15 秒自動檢測一次連線狀態</li>
          <li>斷訊時自動進行指數退避重連（最多 10 次）</li>
          <li>重連延遲從 5 秒開始，最長 5 分鐘</li>
          <li>Claude Code 重啟後會自動恢復連線</li>
          <li>手機 Claude 斷訊會自動觸發重連流程</li>
        </ul>
      </div>
    </div>
  )
}
