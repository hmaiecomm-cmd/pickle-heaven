'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { WeekdayComparison } from '@/server/operation-metrics'

interface WeekdayComparisonChartProps {
  weekday: WeekdayComparison[]
}

export function WeekdayComparisonChart({ weekday }: WeekdayComparisonChartProps) {
  if (weekday.length === 0) return null

  const chartData = weekday.map((w) => ({
    name: w.weekday === 'weekday' ? '平日' : '假日',
    utilization: w.avgUtilization,
    bookings: w.avgBookings,
    entries: w.avgEntries,
  }))

  const weekdayData = chartData.find((d) => d.name === '平日')
  const weekendData = chartData.find((d) => d.name === '假日')
  const diff = weekendData && weekdayData ? weekendData.utilization - weekdayData.utilization : 0

  return (
    <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
      <h3 className="font-semibold text-[#1f4d34] mb-6">平日／假日比較</h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8dc" />
          <XAxis dataKey="name" stroke="#999" />
          <YAxis stroke="#999" />
          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e3e8dc' }} />
          <Bar dataKey="utilization" name="平均使用率 %" fill="#7cb342" radius={[8, 8, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={index} fill={index === 0 ? '#7cb342' : '#4CAF50'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {chartData.map((data) => (
          <div key={data.name} className="p-4 bg-[#f0f4ed] rounded-lg">
            <p className="text-sm text-muted mb-2">{data.name}</p>
            <p className="text-3xl font-bold text-[#1f4d34]">{data.utilization}%</p>
            <div className="mt-3 space-y-1 text-xs text-muted">
              <p>預約：{data.bookings} 次</p>
              <p>進場：{data.entries} 人</p>
            </div>
          </div>
        ))}
      </div>

      {diff > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-900">
            ✅ <strong>假日高出平日 {diff} 個百分點</strong>。平日預約潛力大，建議加強推廣。
          </p>
        </div>
      )}
    </div>
  )
}
