'use client'
import { useState, useEffect } from 'react'
import type { OperationTheme, OperationData } from './member-operations-types'
import { calculateDateRange } from './operation-utils'
import { OperationThemeSelector } from './operation-theme-selector'
import { OperationFilterPanel } from './operation-filter-panel'
import { OperationKpiDisplay } from './operation-kpi-display'
import { OperationMemberList } from './operation-member-list'

export function MemberOperationsDashboard({ initialTheme, initialRangeDays, venueOptions }: any) {
  const [theme, setTheme] = useState<OperationTheme>(initialTheme)
  const [rangeDays, setRangeDays] = useState(initialRangeDays)
  const [data, setData] = useState<OperationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { from, to } = calculateDateRange(rangeDays)
        const response = await fetch('/api/admin/member-operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme, range: { key: rangeDays.toString(), from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0], days: rangeDays }, venues: [], memberTypes: [] })
        })
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('API 錯誤:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [theme, rangeDays])

  if (loading) return <div className="p-12 text-center">加載中...</div>
  if (!data) return <div className="p-12 text-center">暫無資料</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">會員經營與精準溝通</h1>
        <p className="text-sm text-muted mt-1">{data.filters.range.from}～{data.filters.range.to}（{data.filters.range.days} 天）</p>
      </div>
      <OperationThemeSelector value={theme} onChange={setTheme} />
      <OperationFilterPanel rangeDays={rangeDays} onRangeChange={setRangeDays} venues={[]} onVenuesChange={() => {}} memberTypes={[]} onMemberTypesChange={() => {}} venueOptions={venueOptions} />
      {data.hasData && (
        <>
          <OperationKpiDisplay kpis={data.summary.kpis} />
          <OperationMemberList members={data.memberList} title="符合條件的會員推薦名單" />
          {data.dailyActions.map((action, i) => (
            <div key={i} className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
              <h3 className="font-bold">{action.title}</h3>
              <p className="text-sm mt-2">目標客數：{action.targetCount}</p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
