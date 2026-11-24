'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import type { BookingStatusDistribution } from '@/server/operation-metrics'

interface BookingStatusChartProps {
  bookingStatus: BookingStatusDistribution
}

export function BookingStatusChart({ bookingStatus }: BookingStatusChartProps) {
  const total = Object.values(bookingStatus).reduce((sum, v) => sum + v, 0)

  if (total === 0) return null

  const chartData = [
    { name: '已完成', value: bookingStatus.completed, color: '#7cb342' },
    { name: '待付款', value: bookingStatus.pending, color: '#ffc107' },
    { name: '已取消', value: bookingStatus.cancelled, color: '#f44336' },
    { name: '已過期', value: bookingStatus.expired, color: '#9e9e9e' },
    { name: '已退款', value: bookingStatus.refunded, color: '#ff9800' },
  ].filter((item) => item.value > 0)

  return (
    <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm">
      <h3 className="font-semibold text-[#1f4d34] mb-6">預約狀態分布</h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} 筆`} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6">
        <p className="text-center text-3xl font-bold text-[#1f4d34]">{total}</p>
        <p className="text-center text-sm text-muted">總預約數</p>
      </div>

      <div className="mt-6 space-y-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between p-2 bg-[#f0f4ed] rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium text-[#1f4d34]">{item.name}</span>
            </div>
            <span className="text-sm text-muted">
              {item.value} 筆 ({((item.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
