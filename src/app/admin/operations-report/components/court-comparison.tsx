'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import type { CourtComparison } from '@/server/operation-metrics'

interface CourtComparisonChartProps {
  courts: CourtComparison[]
}

export function CourtComparisonChart({ courts }: CourtComparisonChartProps) {
  if (courts.length === 0) return null

  const chartData = courts.map((court) => ({
    name: court.courtName,
    overall: court.utilizationRate,
    peak: court.peakUtilization,
    offPeak: court.offPeakUtilization,
  }))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return '#7cb342'
      case 'fair':
        return '#ffc107'
      case 'needs_attention':
        return '#f44336'
      default:
        return '#999'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'good':
        return '良好'
      case 'fair':
        return '尚可'
      case 'needs_attention':
        return '需關注'
      default:
        return '未知'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm lg:col-span-2">
      <h3 className="font-semibold text-[#1f4d34] mb-6">各場地使用率比較</h3>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8dc" />
          <XAxis dataKey="name" stroke="#999" />
          <YAxis stroke="#999" label={{ value: '使用率 %', angle: -90, position: 'insideLeft' }} />
          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e3e8dc' }} />
          <Legend />
          <Bar dataKey="overall" fill="#7cb342" name="整體使用率" radius={[8, 8, 0, 0]} />
          <Bar dataKey="peak" fill="#4CAF50" name="尖峰使用率" />
          <Bar dataKey="offPeak" fill="#a4c639" name="離峰使用率" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 space-y-3">
        {courts.map((court) => (
          <div key={court.courtId} className="flex items-center justify-between p-3 bg-[#f0f4ed] rounded-lg">
            <div>
              <p className="font-medium text-[#1f4d34]">{court.courtName}</p>
              <p className="text-sm text-muted">
                預約 {court.bookingCount} 次｜取消 {court.cancelationCount} 次
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#1f4d34]">{court.utilizationRate}%</p>
              <div
                className="mt-1 px-2 py-1 rounded text-xs font-medium text-white w-fit ml-auto"
                style={{ backgroundColor: getStatusColor(court.status) }}
              >
                {getStatusLabel(court.status)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {courts.some((c) => c.status === 'needs_attention') && (
        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-900">
            ⚠️ <strong>部分場地使用率低</strong>。建議檢查曝光、價格、設備狀態或時段安排。
          </p>
        </div>
      )}
    </div>
  )
}
