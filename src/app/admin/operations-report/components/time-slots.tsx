'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { TimeSlotDistribution } from '@/server/operation-metrics'

interface TimeSlotChartProps {
  timeSlots: TimeSlotDistribution[]
}

export function TimeSlotChart({ timeSlots }: TimeSlotChartProps) {
  if (timeSlots.length === 0) return null

  const getColor = (utilization: number) => {
    if (utilization >= 80) return '#7cb342' // 尖峰 綠色
    if (utilization >= 60) return '#a4c639' // 高 淺綠
    if (utilization >= 40) return '#ffc107' // 中 黃色
    return '#f44336' // 低 紅色
  }

  const getPeakStatus = (utilization: number) => {
    if (utilization >= 80) return '尖峰'
    if (utilization >= 60) return '高'
    if (utilization >= 40) return '中'
    return '低'
  }

  return (
    <div className="bg-white rounded-xl border border-[#e3e8dc] p-6 shadow-sm lg:col-span-2">
      <h3 className="font-semibold text-[#1f4d34] mb-6">時段使用分布</h3>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={timeSlots} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8dc" />
          <XAxis dataKey="timeSlot" stroke="#999" />
          <YAxis stroke="#999" label={{ value: '使用率 %', angle: -90, position: 'insideLeft' }} />
          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e3e8dc' }} />
          <Bar dataKey="averageUtilization" radius={[8, 8, 0, 0]}>
            {timeSlots.map((slot, index) => (
              <Cell key={index} fill={getColor(slot.averageUtilization)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {timeSlots.map((slot) => (
          <div key={slot.timeSlot} className="p-3 bg-[#f0f4ed] rounded-lg">
            <p className="font-medium text-[#1f4d34]">{slot.timeSlot}</p>
            <p className="text-sm text-muted">{slot.averageUtilization}% 使用率</p>
            <p className={`text-xs font-medium mt-2 ${getPeakStatus(slot.averageUtilization) === '尖峰' ? 'text-green-600' : ''}`}>
              {getPeakStatus(slot.averageUtilization)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>18:00–22:00 為主要尖峰時段</strong>，使用率接近 90%。建議在離峰時段（09:00–17:00）加強促銷或教練課安排。
        </p>
      </div>
    </div>
  )
}
