'use client'

import { Lightbulb } from 'lucide-react'

interface SummarySectionProps {
  summary: string
}

export function SummarySection({ summary }: SummarySectionProps) {
  const lines = summary.split('\n').filter((line) => line.trim())

  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-200 p-6">
      <div className="flex gap-3 mb-4">
        <Lightbulb className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-green-900">營運狀況說明</h3>
          <p className="text-sm text-green-700 mt-1">根據本期資料自動產生的營運分析</p>
        </div>
      </div>

      <div className="space-y-2 ml-9">
        {lines.map((line, index) => (
          <p key={index} className="text-sm text-green-900 leading-relaxed">
            {line}
          </p>
        ))}
      </div>

      {lines.length === 0 && (
        <p className="text-sm text-green-700 ml-9">資料不足，無法生成營運分析。請確保選擇的日期範圍內有充分的營運資料。</p>
      )}
    </div>
  )
}
