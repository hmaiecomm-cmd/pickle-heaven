/**
 * 設備健康狀態與異常警示模型
 *
 * 狀態：綠燈（正常） → 黃燈（警告） → 紅燈常亮（異常） → 紅燈閃爍（嚴重異常）、灰燈（離線）
 */

export type DeviceHealth = 'healthy' | 'warning' | 'error' | 'critical' | 'offline'
export type AnomalyType =
  | 'disconnected'          // 設備斷線
  | 'malfunction'           // 設備故障
  | 'controller_offline'    // 控制器無回應
  | 'command_failed'        // 指令執行失敗
  | 'overload'              // 電力過載
  | 'state_mismatch'        // 設備狀態與預期不符
  | 'schedule_failed'       // 排程執行失敗

export interface DeviceAnomaly {
  id: string
  circuitId: string
  type: AnomalyType
  occurredAt: Date
  lastReportedAt: Date
  severity: 'warning' | 'error' | 'critical'
  status: 'pending' | 'acknowledged' | 'resolved'
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolvedBy?: string
  resolvedAt?: Date
  notes?: string
}

export interface DeviceHealthStatus {
  circuitId: string
  health: DeviceHealth
  anomalies: DeviceAnomaly[]
  lastUpdated: Date
  isDemo: boolean
}

/**
 * 健康狀態顏色方案
 */
export const HEALTH_COLORS = {
  healthy: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    label: '正常',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    label: '警告',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: '異常',
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-600',  // 深紅色用於嚴重異常
    label: '嚴重異常',
  },
  offline: {
    bg: 'bg-zinc-50',
    text: 'text-zinc-600',
    border: 'border-zinc-200',
    dot: 'bg-zinc-400',
    label: '離線',
  },
}

/**
 * 異常類型標籤
 */
export const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  disconnected: '設備斷線',
  malfunction: '設備故障',
  controller_offline: '控制器無回應',
  command_failed: '指令執行失敗',
  overload: '電力過載',
  state_mismatch: '狀態不符',
  schedule_failed: '排程執行失敗',
}

/**
 * 根據異常判定健康狀態
 */
export function determineHealth(anomalies: DeviceAnomaly[]): DeviceHealth {
  if (anomalies.length === 0) return 'healthy'

  const critical = anomalies.some(a => a.severity === 'critical')
  if (critical) return 'critical'

  const error = anomalies.some(a => a.severity === 'error')
  if (error) return 'error'

  return 'warning'
}

/**
 * 判定是否需要紅燈閃爍
 */
export function shouldBlink(health: DeviceHealth): boolean {
  return health === 'critical'
}
