'use client'

import * as React from 'react'
import { RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'

interface CheckResult {
  checkType: string
  success: boolean
  message: string
  detectedAt: Date
  affectedResourceCount: number
}

interface Summary {
  total: number
  passed: number
  failed: number
  warnings: number
}

export function WatchdogClient({ venueId }: { venueId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [checkResults, setCheckResults] = React.useState<CheckResult[]>([])
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [lastRunAt, setLastRunAt] = React.useState<Date | null>(null)
  const [alerts, setAlerts] = React.useState<any[]>([])
  const [showAlerts, setShowAlerts] = React.useState(false)

  // 執行 Watchdog 檢測
  const runChecks = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/door/watchdog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast(error.error || '檢測失敗', 'error')
        return
      }

      const data = await res.json()
      setCheckResults(data.checkResults)
      setSummary(data.summary)
      setLastRunAt(new Date(data.runAt))

      if (data.summary.failed > 0) {
        toast(`檢測完成：${data.summary.failed} 項失敗，${data.summary.passed} 項通過`, 'error')
      } else {
        toast('✅ 所有檢測通過', 'success')
      }

      // 更新告警列表
      await loadAlerts()
    } catch (error) {
      toast('執行檢測時發生錯誤', 'error')
      console.error(error)
    } finally {
      setChecking(false)
    }
  }

  // 加載告警歷史
  const loadAlerts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/door/watchdog?venueId=${venueId}`)
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error('加載告警失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadAlerts()
  }, [venueId])

  const checkTypeLabels: Record<string, { name: string; category: string }> = {
    SCHEDULE_TO_MQTT_TIMEOUT: { name: '排程→MQTT超時', category: '通信' },
    MQTT_TO_PI_TIMEOUT: { name: 'MQTT→Pi超時', category: '通信' },
    PI_TO_CONTROLLER_TIMEOUT: { name: 'Pi→控制器超時', category: '通信' },
    CREDENTIAL_APPLY_MISMATCH: { name: '憑證寫入不一致', category: '憑證' },
    CREDENTIAL_APPLIED_NOTIFICATION_FAILED: { name: '通知失敗', category: '通知' },
    CANCELLED_CREDENTIAL_STILL_ACTIVE: { name: '取消後仍有效', category: '憑證' },
    EXPIRED_CREDENTIAL_NOT_REMOVED: { name: '過期憑證未移除', category: '憑證' },
    CONTROLLER_CLOCK_DRIFT: { name: '控制器時鐘漂移', category: '時間' },
    PI_CLOCK_DRIFT: { name: 'Pi時鐘漂移', category: '時間' },
    DOOR_HELD_OPEN_TIMEOUT: { name: '門長開啟', category: '門狀態' },
    ACCESS_LOG_VS_DOOR_MISMATCH: { name: '交易vs門磁矛盾', category: '狀態' },
    MISSING_CONTROLLER_TRANSACTION_LOG: { name: '缺少交易記錄', category: '日誌' },
    REVOKE_PENDING_UNRESOLVED: { name: '撤銷未確認', category: '撤銷' },
  }

  const getCheckLabel = (checkType: string) => {
    return checkTypeLabels[checkType] || { name: checkType, category: '其他' }
  }

  return (
    <div className="space-y-4">
      {/* 狀態卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-1 text-xs text-muted">檢測總數</div>
          <div className="text-3xl font-bold text-zinc-900">{summary?.total ?? 13}</div>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="mb-1 text-xs text-green-700 font-medium">通過</div>
          <div className="text-3xl font-bold text-green-700">{summary?.passed ?? '-'}</div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-1 text-xs text-red-700 font-medium">失敗</div>
          <div className="text-3xl font-bold text-red-700">{summary?.failed ?? '-'}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 text-xs text-amber-700 font-medium">上次執行</div>
          <div className="text-sm text-amber-700">
            {lastRunAt
              ? new Date(lastRunAt).toLocaleString('zh-TW', {
                  timeZone: 'Asia/Taipei',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '未執行'}
          </div>
        </div>
      </div>

      {/* 控制按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={runChecks}
          disabled={checking}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} />
          {checking ? '檢測中...' : '執行檢測'}
        </button>
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          <AlertCircle className="h-4 w-4" />
          告警歷史 ({alerts.length})
        </button>
      </div>

      {/* 檢測結果 */}
      {checkResults.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <h3 className="font-semibold text-sm">13 項檢測結果</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {checkResults.map((result) => {
              const label = getCheckLabel(result.checkType)
              return (
                <div key={result.checkType} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{label.name}</div>
                        <div className="text-xs text-muted mt-0.5">{result.message}</div>
                      </div>
                    </div>
                    <Pill tone={result.success ? 'green' : 'red'}>
                      {result.success ? '通過' : '失敗'}
                    </Pill>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{label.category}</span>
                    {result.affectedResourceCount > 0 && (
                      <span className="text-red-600 font-medium">
                        影響 {result.affectedResourceCount} 項資源
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 告警歷史 */}
      {showAlerts && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <h3 className="font-semibold text-sm">告警歷史 ({alerts.length})</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">沒有告警記錄</div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs line-clamp-1">{alert.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{alert.description}</div>
                    </div>
                    <Pill
                      tone={
                        alert.severity === 'ERROR'
                          ? 'red'
                          : alert.severity === 'DEGRADED'
                            ? 'amber'
                            : 'green'
                      }
                    >
                      {alert.severity}
                    </Pill>
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(alert.createdAt).toLocaleString('zh-TW', {
                      timeZone: 'Asia/Taipei',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 說明 */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <div className="flex gap-3">
          <Zap className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-900">
            <div className="font-medium mb-1">Watchdog 監控系統</div>
            <div className="text-xs text-blue-700">
              13 項自動檢測涵蓋：通信超時、憑證一致性、時鐘漂移、門狀態異常、交易日誌完整性等。點擊「執行檢測」立即掃描，或設置定時任務自動監控。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
