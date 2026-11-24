'use client'

import { Calendar, Clock, Users, DoorOpen, TrendingUp, TrendingDown } from 'lucide-react'
import type { OperationMetrics } from '@/server/operation-metrics'

interface MetricsCardsProps {
  metrics: OperationMetrics
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {/* 預約完成率 */}
      <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 rounded-xl border border-pink-200 p-4 md:p-6">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-pink-600 uppercase tracking-wide font-medium truncate">預約完成率</p>
            <p className="text-2xl md:text-3xl font-bold text-pink-700 mt-1 md:mt-2">{metrics.bookingCompletion.completionRate}%</p>
          </div>
          <Calendar className="h-5 md:h-6 w-5 md:w-6 text-pink-500 shrink-0 ml-2" strokeWidth={1.5} />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {metrics.bookingCompletion.changePercent >= 0 ? (
            <>
              <TrendingUp className="h-3 w-3 text-green-600 shrink-0" />
              <span className="text-green-600 truncate">上升 {metrics.bookingCompletion.changePercent}%</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 text-red-600 shrink-0" />
              <span className="text-red-600 truncate">下降 {Math.abs(metrics.bookingCompletion.changePercent)}%</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted mt-2 md:mt-3 line-clamp-2">已完成預約占全部預約比例</p>
      </div>

      {/* 場地使用率 */}
      <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-200 p-4 md:p-6">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-amber-600 uppercase tracking-wide font-medium truncate">場地使用率</p>
            <p className="text-2xl md:text-3xl font-bold text-amber-700 mt-1 md:mt-2">{metrics.courtUtilization.overallUtilization}%</p>
          </div>
          <Clock className="h-5 md:h-6 w-5 md:w-6 text-amber-500 shrink-0 ml-2" strokeWidth={1.5} />
        </div>
        <p className="text-xs md:text-sm text-amber-700 mt-1 md:mt-2 truncate">尖峰 {metrics.courtUtilization.peakUtilization}%</p>
        <p className="text-xs text-muted mt-2 md:mt-3 line-clamp-2">目前場地實際使用程度</p>
      </div>

      {/* 進場人次 */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-4 md:p-6">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-medium truncate">進場人次</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-700 mt-1 md:mt-2">{metrics.entries.totalEntries.toLocaleString()}</p>
          </div>
          <Users className="h-5 md:h-6 w-5 md:w-6 text-blue-500 shrink-0 ml-2" strokeWidth={1.5} />
        </div>
        <p className="text-xs md:text-sm text-blue-700 mt-1 md:mt-2 truncate">平均每日 {metrics.entries.averagePerDay} 人</p>
        <p className="text-xs text-muted mt-2 md:mt-3 line-clamp-2">依預約與進場紀錄統計</p>
      </div>

      {/* 門禁開門成功率 */}
      <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-200 p-4 md:p-6">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-green-600 uppercase tracking-wide font-medium truncate">門禁開門成功率</p>
            <p className="text-2xl md:text-3xl font-bold text-green-700 mt-1 md:mt-2">{metrics.doorAccess.successRate}%</p>
          </div>
          <DoorOpen className="h-5 md:h-6 w-5 md:w-6 text-green-500 shrink-0 ml-2" strokeWidth={1.5} />
        </div>
        <p className="text-xs md:text-sm text-green-700 mt-1 md:mt-2 truncate">成功 {metrics.doorAccess.successCount} 次</p>
        {!metrics.doorAccess.hasData && (
          <p className="text-xs text-orange-600 mt-2 md:mt-3">設備資料未更新</p>
        )}
      </div>
    </div>
  )
}
