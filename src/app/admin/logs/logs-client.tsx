/**
 * 日誌檢視 — 客戶端元件
 *
 * 支援篩選、搜尋、分頁、匯出
 */

'use client'

import { useState, useCallback } from 'react'
import { formatDateTime } from '@/lib/time'

interface LogEvent {
  id: string
  eventId: string
  eventType: string
  severity: 'INFO' | 'WARNING' | 'ERROR'
  environment: 'SIMULATION' | 'PRODUCTION'
  title: string
  description?: string
  circuit?: { circuitNumber: string; name: string }
  commandId?: string
  reservationId?: string
  createdAt: string
  syncedToNeon: boolean
}

interface QueryParams {
  eventType: string[]
  severity: string[]
  environment?: string
  startDate?: string
  endDate?: string
  limit: number
  offset: number
}

const EVENT_TYPES = [
  'RESERVATION_CREATED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_CANCELLED',
  'COMMAND_SENT',
  'COMMAND_ACKED',
  'COMMAND_FAILED',
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'STATUS_MISMATCH',
  'MQTT_CONNECTED',
  'MQTT_DISCONNECTED',
  'WATCHDOG_ALERT',
  'SYSTEM_ERROR',
]

const SEVERITIES = ['INFO', 'WARNING', 'ERROR']

export function LogsClient() {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [params, setParams] = useState<QueryParams>({
    eventType: [],
    severity: [],
    limit: 50,
    offset: 0,
  })

  // 查詢日誌
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      // 假設有 venueId（從上下文或 URL 取得）
      query.append('venueId', 'venue-001') // TODO: 從上下文取得
      if (params.eventType.length > 0) {
        query.append('eventType', params.eventType.join(','))
      }
      if (params.severity.length > 0) {
        query.append('severity', params.severity.join(','))
      }
      if (params.environment) {
        query.append('environment', params.environment)
      }
      query.append('limit', String(params.limit))
      query.append('offset', String(params.offset))

      const res = await fetch(`/api/admin/logs?${query}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('查詢失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [params])

  // 汇出 CSV
  const exportCSV = async () => {
    try {
      const query = new URLSearchParams()
      query.append('venueId', 'venue-001')
      if (params.eventType.length > 0) {
        query.append('eventType', params.eventType.join(','))
      }
      if (params.severity.length > 0) {
        query.append('severity', params.severity.join(','))
      }
      query.append('limit', String(total > 10000 ? 10000 : total))

      const res = await fetch(`/api/admin/logs?${query}`)
      const data = await res.json()

      // 生成 CSV
      const headers = ['時間', '事件類型', '嚴重程度', '標題', '描述', '迴路', '同步狀態']
      const rows = data.data.map((log: LogEvent) => [
        formatDateTime(new Date(log.createdAt)),
        log.eventType,
        log.severity,
        log.title,
        log.description || '',
        log.circuit?.name || '',
        log.syncedToNeon ? '✓ 已同步' : '⏳ 待同步',
      ])

      const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')

      // 下載
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `logs-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    } catch (error) {
      console.error('匯出失敗:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* 篩選條件 */}
      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold mb-3">篩選條件</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 事件類型 */}
          <div>
            <label className="text-sm font-medium">事件類型</label>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {EVENT_TYPES.map((type) => (
                <label key={type} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={params.eventType.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...params.eventType, type]
                        : params.eventType.filter((t) => t !== type)
                      setParams({ ...params, eventType: newTypes, offset: 0 })
                    }}
                    className="mr-2"
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* 嚴重程度 */}
          <div>
            <label className="text-sm font-medium">嚴重程度</label>
            <div className="mt-2 space-y-1">
              {SEVERITIES.map((sev) => (
                <label key={sev} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={params.severity.includes(sev)}
                    onChange={(e) => {
                      const newSev = e.target.checked
                        ? [...params.severity, sev]
                        : params.severity.filter((s) => s !== sev)
                      setParams({ ...params, severity: newSev, offset: 0 })
                    }}
                    className="mr-2"
                  />
                  <span className="inline-block w-2 h-2 rounded-full mr-2 bg-gray-400" />
                  {sev}
                </label>
              ))}
            </div>
          </div>

          {/* 環境 */}
          <div>
            <label className="text-sm font-medium">環境</label>
            <div className="mt-2 space-y-1">
              {['SIMULATION', 'PRODUCTION'].map((env) => (
                <label key={env} className="flex items-center text-sm">
                  <input
                    type="radio"
                    name="environment"
                    value={env}
                    checked={params.environment === env}
                    onChange={(e) =>
                      setParams({ ...params, environment: e.target.value, offset: 0 })
                    }
                    className="mr-2"
                  />
                  {env}
                </label>
              ))}
              <label className="flex items-center text-sm">
                <input
                  type="radio"
                  name="environment"
                  checked={!params.environment}
                  onChange={() => setParams({ ...params, environment: undefined, offset: 0 })}
                  className="mr-2"
                />
                全部
              </label>
            </div>
          </div>
        </div>

        {/* 動作按鈕 */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? '查詢中...' : '查詢'}
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            📥 匯出 CSV
          </button>
        </div>
      </div>

      {/* 結果表格 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">時間</th>
              <th className="text-left px-3 py-2">事件類型</th>
              <th className="text-left px-3 py-2">嚴重程度</th>
              <th className="text-left px-3 py-2">標題</th>
              <th className="text-left px-3 py-2">迴路</th>
              <th className="text-left px-3 py-2">同步狀態</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 text-xs text-muted">
                  {formatDateTime(new Date(log.createdAt))}
                </td>
                <td className="px-3 py-2 text-xs font-mono">{log.eventType}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      log.severity === 'ERROR'
                        ? 'bg-red-100 text-red-700'
                        : log.severity === 'WARNING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {log.severity}
                  </span>
                </td>
                <td className="px-3 py-2">{log.title}</td>
                <td className="px-3 py-2 text-xs">
                  {log.circuit && (
                    <>
                      {log.circuit.circuitNumber}: {log.circuit.name}
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {log.syncedToNeon ? '✓ 已同步' : '⏳ 待同步'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="text-center py-6 text-muted">沒有符合條件的日誌</div>
        )}
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">共 {total} 條 / 每頁 {params.limit} 條</span>
        <div className="space-x-2">
          <button
            onClick={() => setParams({ ...params, offset: Math.max(0, params.offset - params.limit) })}
            disabled={params.offset === 0 || loading}
            className="px-3 py-1 border rounded hover:bg-muted disabled:text-muted"
          >
            ← 上一頁
          </button>
          <span className="text-muted">
            {Math.floor(params.offset / params.limit) + 1} / {Math.ceil(total / params.limit)}
          </span>
          <button
            onClick={() =>
              setParams({
                ...params,
                offset: params.offset + params.limit,
              })
            }
            disabled={params.offset + params.limit >= total || loading}
            className="px-3 py-1 border rounded hover:bg-muted disabled:text-muted"
          >
            下一頁 →
          </button>
        </div>
      </div>
    </div>
  )
}
