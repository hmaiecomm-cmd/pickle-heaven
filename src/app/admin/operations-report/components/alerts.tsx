'use client'

import { AlertCircle, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import type { OperationAlert } from '@/server/operation-metrics'

interface AlertsSectionProps {
  alerts: OperationAlert[]
}

export function AlertsSection({ alerts }: AlertsSectionProps) {
  if (alerts.length === 0) return null

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_utilization':
        return <AlertTriangle className="h-5 w-5" />
      case 'high_failures':
        return <AlertCircle className="h-5 w-5" />
      case 'court_gap':
        return <AlertTriangle className="h-5 w-5" />
      case 'no_data':
        return <Info className="h-5 w-5" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  const getAlertBg = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-orange-50 border-orange-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-700'
      case 'warning':
        return 'text-orange-700'
      case 'info':
        return 'text-blue-700'
      default:
        return 'text-gray-700'
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-[#1f4d34]">營運異常提示</h3>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 ${getAlertBg(alert.severity)}`}
        >
          <div className="flex gap-4">
            <div className={`flex-shrink-0 ${getAlertColor(alert.severity)}`}>
              {getAlertIcon(alert.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold ${getAlertColor(alert.severity)}`}>
                {alert.title}
              </h4>
              <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
              {alert.action && (
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-1">
                  {alert.action}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
