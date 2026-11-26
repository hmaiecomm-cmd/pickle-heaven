'use client'

import * as React from 'react'
import { AlertCircle, AlertTriangle, Zap, Users, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyAction } from './member-insights-types'

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: AlertTriangle },
  medium: { color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700', icon: AlertCircle },
  low: { color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', icon: Zap },
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] focus-visible:ring-offset-1'

function ActionItemCompact({ action }: { action: DailyAction }) {
  const config = PRIORITY_CONFIG[action.priority]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border-l-4 ${config.color} p-3`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${config.color}`}>
          <Icon className={`h-3 w-3 ${config.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-[#1f2a22] truncate">{action.title}</p>
              <p className="text-xs text-muted line-clamp-1">{action.description}</p>
            </div>
            <div className={`inline-flex shrink-0 items-center gap-1 rounded-lg ${config.color} px-2 py-1 text-xs font-semibold ${config.textColor}`}>
              <Users className="h-3 w-3" />
              {action.actionCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionItemExpanded({ action }: { action: DailyAction }) {
  const config = PRIORITY_CONFIG[action.priority]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border-l-4 ${config.color} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${config.color}`}>
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
}

export function MemberDailyActions({ actions, title = '今日行動建議', compact = true, maxDisplay = 5 }: { actions: DailyAction[]; title?: string; compact?: boolean; maxDisplay?: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const displayCount = expanded ? actions.length : Math.min(maxDisplay, actions.length)
  const displayActions = actions.slice(0, displayCount)
  const hasMore = actions.length > maxDisplay

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-[#1f2a22]">{title}</h3>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn('flex items-center gap-1 text-xs font-semibold text-[#2f7d3b] hover:text-[#1f4d34]', focusRing)}
          >
            {expanded ? (
              <>
                收合 <ChevronDown className="h-3 w-3 rotate-180" />
              </>
            ) : (
              <>
                查看全部 ({actions.length}) <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2 sm:space-y-3">
        {displayActions.map((action) =>
          compact && !expanded ? (
            <ActionItemCompact key={action.id} action={action} />
          ) : (
            <ActionItemExpanded key={action.id} action={action} />
          )
        )}
      </div>

      {actions.length === 0 && <p className="text-center text-sm text-muted py-8">暫時沒有建議行動</p>}
    </div>
  )
}
