export type RangeKey = '7' | '30' | '90' | '180' | 'custom'
export type ChartKey = 'usage' | 'courts' | 'heatmap' | 'revenue'

export interface OverviewRange {
  key: RangeKey
  from: string
  to: string
  days: number
  prevFrom: string
  prevTo: string
}

export interface Kpi {
  value: number
  prev: number
  /** 使用率為百分點差，其餘為成長百分比；前期為 0 時為 null（無法比較） */
  change: number | null
}

export type CourtState = 'IN_USE' | 'AVAILABLE' | 'MAINTENANCE' | 'SUSPENDED'

export interface OverviewData {
  range: OverviewRange
  venueName: string
  courtOptions: { id: string; name: string }[]
  courtId: string | null
  hasData: boolean
  kpi: { utilization: Kpi; revenue: Kpi; orders: Kpi; members: Kpi }
  usage: { label: string; value: number }[]
  heatmap: { hours: string[]; rows: { label: string; values: number[] }[] }
  courts: { id: string; name: string; status: CourtState; rate: number | null }[]
  revenue: {
    series: { label: string; court: number; event: number; topup: number; total: number }[]
    sources: { key: string; label: string; amount: number; available: boolean }[]
  }
}

export const RANGE_LABEL: Record<RangeKey, string> = { '7': '近 7 天', '30': '近 30 天', '90': '近 90 天', '180': '近 180 天', custom: '自訂日期' }
export const CHART_META: Record<ChartKey, { title: string; desc: string }> = {
  usage: { title: '使用率趨勢', desc: '查看場地使用率變化' },
  courts: { title: '場地圖', desc: '查看各場地目前狀態' },
  heatmap: { title: '使用熱力圖', desc: '找出熱門與離峰時段' },
  revenue: { title: '營收記錄', desc: '查看收入變化與來源' },
}
