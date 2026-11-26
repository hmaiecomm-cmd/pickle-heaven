'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { OperationKpis } from './member-operations-types'

export function OperationKpiDisplay({ kpis }: { kpis: OperationKpis }) {
  const kpiList = [
    { label: '可溝通會員數', kpi: kpis.communicableMembers },
    { label: 'LINE 綁定率', kpi: kpis.lineBindRate },
    { label: '近 30 天活躍會員', kpi: kpis.active30d },
    { label: '高頻臨打客', kpi: kpis.highFreqCasual },
    { label: '儲值會員數', kpi: kpis.prepaidMembers },
    { label: '季卡即將到期', kpi: kpis.cardExpiring14d },
    { label: '沉睡會員', kpi: kpis.dormantMembers },
    { label: '主揪會員', kpi: kpis.organizerMembers },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpiList.map(item => (
        <div key={item.label} className="rounded-2xl border border-[#e3e8dc] bg-white p-4">
          <p className="text-xs text-muted">{item.label}</p>
          <p className="mt-2 text-2xl font-bold">{item.kpi.value}</p>
          <p className="text-xs mt-1">{item.kpi.change?.toFixed(1)}% vs 前期</p>
        </div>
      ))}
    </div>
  )
}
