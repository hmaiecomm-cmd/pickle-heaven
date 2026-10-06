'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Camera, Fan, Lock, LockOpen, Lightbulb, QrCode, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMockCourtInfo, getMockAIEvents, CourtInfo, AIEvent, CourtState } from '@/lib/device-adapter'

function getStateColor(state: CourtState) {
  switch (state) {
    case 'occupied':
      return 'text-blue-600'
    case 'reserved':
      return 'text-yellow-600'
    case 'unauthorized':
      return 'text-red-600'
    default:
      return 'text-green-600'
  }
}

function getStateLabel(state: CourtState) {
  switch (state) {
    case 'occupied':
      return '使用中'
    case 'reserved':
      return '已預約'
    case 'unauthorized':
      return '未授權使用'
    default:
      return '可用'
  }
}

export function AICourtsClient() {
  const [courts, setCourts] = useState<CourtInfo[]>([])
  const [events, setEvents] = useState<AIEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const court1 = getMockCourtInfo('court-1')
    const court2 = getMockCourtInfo('court-2')
    setCourts([court1, court2])
    setEvents(getMockAIEvents())
    setLoading(false)
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-muted">載入中...</div>
  }

  return (
    <div className="space-y-6">
      {/* Courts Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {courts.map((court) => (
          <CourtCard key={court.id} court={court} />
        ))}
      </div>

      {/* AI Events */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold">AI 事件中心</h2>
            <span className="ml-auto text-xs text-muted">{events.length} 個未解決事件</span>
          </div>

          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">沒有異常事件</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <AIEventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Management */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <h2 className="text-sm font-semibold">QR 智慧門禁</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="sm" className="w-full">
              生成新 QR Code
            </Button>
            <Button variant="secondary" size="sm" className="w-full">
              撤銷 QR Code
            </Button>
            <Button variant="secondary" size="sm" className="w-full">
              門禁日誌
            </Button>
            <Button variant="secondary" size="sm" className="w-full">
              無效警告
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CourtCard({ court }: { court: CourtInfo }) {
  return (
    <Card className={court.state === 'unauthorized' ? 'border-red-500 border-2' : ''}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{court.name}</h3>
            <p className={`text-sm font-medium ${getStateColor(court.state)}`}>{getStateLabel(court.state)}</p>
          </div>
          {court.currentBooking && (
            <div className="text-right text-xs text-muted">
              <p>{court.currentBooking.startTime}–{court.currentBooking.endTime}</p>
              <p className="mt-1">{court.currentBooking.players.length} 人預約</p>
            </div>
          )}
        </div>

        {/* Booking Info */}
        {court.currentBooking && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-1">
            <p className="font-medium">預約人員</p>
            <p className="text-muted">{court.currentBooking.players.join('、')}</p>
          </div>
        )}

        {/* AI Detection */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">AI 偵測人數</span>
          <span className="font-semibold text-lg">{court.peopleDetected}</span>
        </div>

        {/* Devices Status */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">設備狀態</p>
          <div className="grid grid-cols-3 gap-2">
            <DeviceButton icon={Lock} label="門禁" status={court.devices.door.status} />
            <DeviceButton icon={Lightbulb} label="照明" status={court.devices.lights.status} />
            <DeviceButton icon={Fan} label="風扇" status={court.devices.fans.status} />
            <DeviceButton icon={Camera} label={`攝像頭 (${court.devices.cameras.length})`} status={court.devices.cameras[0]?.status || 'online'} />
            <DeviceButton icon={AlertCircle} label="喇叭" status={court.devices.speaker.status} />
          </div>
        </div>

        {/* Last Event */}
        {court.lastEvent && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-2.5 text-xs">
            <p className="font-medium">{court.lastEvent.type}</p>
            <p className="text-muted mt-1">{court.lastEvent.description}</p>
            <p className="text-muted mt-1">{court.lastEvent.time.toLocaleTimeString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeviceButton({ icon: Icon, label, status }: { icon: React.ElementType; label: string; status: string }) {
  const isOnline = status === 'online'
  return (
    <button
      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-xs font-medium transition-colors ${
        isOnline
          ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="text-[10px]">{isOnline ? '正常' : '離線'}</span>
    </button>
  )
}

function AIEventItem({ event }: { event: AIEvent }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
      case 'high':
        return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900'
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900'
      default:
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '嚴重'
      case 'high':
        return '高'
      case 'medium':
        return '中'
      default:
        return '低'
    }
  }

  return (
    <div className={`rounded-lg border p-3 ${getSeverityColor(event.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">{event.description}</p>
          <p className="text-xs text-muted">{event.timestamp.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-900">
            {getSeverityLabel(event.severity)}
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            解決
          </Button>
        </div>
      </div>
    </div>
  )
}
