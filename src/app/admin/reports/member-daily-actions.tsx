'use client'

import { AlertCircle, AlertTriangle, Zap, Users } from 'lucide-react'
import type { DailyAction } from './member-insights-types'

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: AlertTriangle },
  medium: { color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700', icon: AlertCircle },
  low: { color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', icon: Zap },
}

export function MemberDailyActions({ actions, title = '每日行動清單' }: { actions: DailyAction[]; title?: string }) {
  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-5">
      <h3 className="text-lg font-bold text-[#1f2a22] mb-4">{title}</h3>
      <div className="space-y-3">
        {actions.map((action) => {
          const config = PRIORITY_CONFIG[action.priority]
          const Icon = config.icon
          return (
            <div key={action.id} className={`rounded-lg border-l-4 ${config.color} p-4`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${config.color}`}>
                  <Icon className={`h-4 w-4 ${config.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1f2a22]">{action.title}</h4>
                      <p className="mt-1 text-sm text-muted">{action.description}</p>
                    </div>
                    <div className={`mt-2 inline-flex shrink-0 items-center gap-1 rounded-lg ${config.color} px-2 py-1 text-xs font-semibold sm:mt-0 ${config.textColor}`}>
                      <Users className="h-3 w-3" />
                      {action.actionCount}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:flex sm:gap-4">
                    <div>
                      <p className="text-muted">目標分群</p>
                      <p className="font-semibold text-[#1f2a22]">{action.targetSegment}</p>
                    </div>
                    <div>
                      <p className="text-muted">預期影響</p>
                      <p className="font-semibold text-[#2f7d3b]">{action.estimatedImpact}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {actions.length === 0 && <p className="text-center text-sm text-muted py-8">暫時沒有建議行動</p>}
    </div>
  )
}
