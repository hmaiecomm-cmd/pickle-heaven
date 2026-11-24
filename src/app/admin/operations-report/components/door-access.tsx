'use client'

import { DoorOpen, AlertCircle } from 'lucide-react'
import type { DoorAccessMetrics } from '@/server/operation-metrics'

interface DoorAccessCardProps {
  doorAccess: DoorAccessMetrics
}

export function DoorAccessCard({ doorAccess }: DoorAccessCardProps) {
  if (!doorAccess.hasData) {
    return (
      <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-50 rounded-lg">
            <AlertCircle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h4 className="font-semibold text-[#1f4d34]">設備資料尚未更新</h4>
            <p className="text-sm text-muted mt-1">目前無法取得最新門禁資料，請確認設備串接狀態。</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <DoorOpen className="h-5 w-5 text-[#7cb342]" />
        <h3 className="font-semibold text-[#1f4d34]">門禁與進出紀錄</h3>
      </div>

      <div className="space-y-4">
        {/* 開門成功率 */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg border border-green-200">
          <p className="text-xs text-green-600 uppercase font-medium mb-2">開門成功率</p>
          <p className="text-3xl font-bold text-green-700">{doorAccess.successRate}%</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-white rounded">
              <p className="text-xs text-muted">成功次數</p>
              <p className="font-semibold text-[#1f4d34]">{doorAccess.successCount}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <p className="text-xs text-muted">失敗次數</p>
              <p className="font-semibold text-red-600">{doorAccess.failureCount}</p>
            </div>
          </div>
        </div>

        {/* 授權方式統計 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#f0f4ed] rounded-lg">
            <p className="text-xs text-muted mb-1">預約授權開門</p>
            <p className="text-lg font-bold text-[#1f4d34]">─</p>
          </div>
          <div className="p-3 bg-[#f0f4ed] rounded-lg">
            <p className="text-xs text-muted mb-1">手動授權開門</p>
            <p className="text-lg font-bold text-[#1f4d34]">─</p>
          </div>
          <div className="p-3 bg-[#f0f4ed] rounded-lg">
            <p className="text-xs text-muted mb-1">密碼開門</p>
            <p className="text-lg font-bold text-[#1f4d34]">─</p>
          </div>
          <div className="p-3 bg-[#f0f4ed] rounded-lg">
            <p className="text-xs text-muted mb-1">遠端開門</p>
            <p className="text-lg font-bold text-[#1f4d34]">─</p>
          </div>
        </div>

        {doorAccess.failureCount > 10 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-orange-900">
              ⚠️ 本期解鎖失敗次數較多，建議檢查門禁設備或網路連接。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
