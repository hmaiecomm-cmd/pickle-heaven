/**
 * 管理首頁 — 電力控制摘要卡片
 *
 * 在既有的 /admin 首頁中新增此區塊
 */

import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { getWatchdogSummary } from '@/server/watchdog-service'
import { getMqttStatus } from '@/server/mqtt-service'
import { getEventStats } from '@/server/event-logger'

interface ControlSummaryProps {
  venueId: string
}

export async function ControlSystemSummary({ venueId }: ControlSummaryProps) {
  // 並行查詢
  const [watchdog, eventStats, circuits, commands] = await Promise.all([
    getWatchdogSummary(venueId),
    getEventStats(venueId, 24),
    prisma.circuit.findMany({
      where: { venueId, enabled: true },
      select: {
        id: true,
        circuitNumber: true,
        name: true,
        expectedState: true,
        actualState: true,
        lastCommandStatus: true,
      },
    }),
    prisma.controlCommand.findMany({
      where: { circuit: { venueId }, status: { in: ['SENT', 'FAILED', 'TIMEOUT'] } },
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { circuit: { select: { name: true } } },
    }),
  ])

  // 計算迴路狀態統計
  const circuitStats = {
    total: circuits.length,
    online: circuits.filter((c) => c.actualState !== null).length,
    offline: circuits.filter((c) => c.actualState === null).length,
    mismatch: circuits.filter((c) => c.expectedState !== c.actualState).length,
  }

  // MQTT 連接狀態
  const mqttStatus = getMqttStatus()

  return (
    <div className="space-y-4">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">無人化控制系統</h3>
        <span className="text-xs text-muted px-2 py-1 bg-muted/20 rounded">模擬環境</span>
      </div>

      {/* 主要指標 - 4 列網格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* MQTT 狀態 */}
        <div className="border rounded-lg p-3 bg-card">
          <p className="text-xs text-muted mb-1">MQTT Broker</p>
          <p className="text-sm font-semibold">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${
                mqttStatus === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {mqttStatus}
          </p>
        </div>

        {/* 迴路在線 */}
        <div className="border rounded-lg p-3 bg-card">
          <p className="text-xs text-muted mb-1">迴路在線</p>
          <p className="text-sm font-semibold">{circuitStats.online} / {circuitStats.total}</p>
        </div>

        {/* Watchdog 告警 */}
        <div className="border rounded-lg p-3 bg-card">
          <p className="text-xs text-muted mb-1">開啟告警</p>
          <p className={`text-sm font-semibold ${watchdog.openAlerts > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {watchdog.openAlerts} 個
          </p>
        </div>

        {/* 日誌未同步 */}
        <div className="border rounded-lg p-3 bg-card">
          <p className="text-xs text-muted mb-1">待同步日誌</p>
          <p className={`text-sm font-semibold ${eventStats.unsyncedCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {eventStats.unsyncedCount} 條
          </p>
        </div>
      </div>

      {/* Watchdog 最近告警 */}
      {watchdog.openAlerts > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-yellow-900 mb-2">
            ⚠️ 最近告警（{watchdog.openAlerts} 個開啟）
          </p>
          <div className="space-y-1">
            {watchdog.recentAlerts.slice(0, 2).map((alert) => (
              <p key={alert.id} className="text-xs text-yellow-800">
                • {alert.title}
              </p>
            ))}
          </div>
          <a
            href="/admin/watchdog"
            className="text-xs text-yellow-700 hover:underline mt-2 inline-block"
          >
            查看全部告警 →
          </a>
        </div>
      )}

      {/* 待確認命令 */}
      {commands.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 mb-2">
            📡 待確認命令（{commands.length} 個）
          </p>
          <div className="space-y-1">
            {commands.map((cmd) => (
              <p key={cmd.id} className="text-xs text-blue-800">
                • {cmd.circuit.name} — {cmd.status}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 快速連結 */}
      <div className="flex gap-2">
        <a
          href="/admin/control"
          className="flex-1 text-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded border border-blue-200"
        >
          ⚡ 電力控制
        </a>
        <a
          href="/admin/logs"
          className="flex-1 text-center px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm rounded border border-gray-200"
        >
          📋 日誌檢視
        </a>
        <a
          href="/admin/watchdog"
          className="flex-1 text-center px-3 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-sm rounded border border-yellow-200"
        >
          👁️ 監控告警
        </a>
      </div>
    </div>
  )
}
