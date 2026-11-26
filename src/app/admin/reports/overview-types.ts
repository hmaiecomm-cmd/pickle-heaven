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
export const CHART_META: Record<ChartKey, { title: string; desc: string; explanation: string }> = {
  usage: {
    title: '使用率趨勢',
    desc: '查看場地使用率變化',
    explanation: '這張圖表顯示每天場地被預約或使用的比例。數值越高代表場地越熱門，數值較低的日期或時段，就是可以優先規劃優惠或活動的空場機會。'
  },
  courts: {
    title: '場地圖',
    desc: '查看各場地目前狀態',
    explanation: '這張圖表比較不同場地目前的使用狀況。可以看出哪一面場地最熱門、哪一面較少人使用，協助管理者調整價格、安排活動或分配維護時間。'
  },
  heatmap: {
    title: '使用熱力圖',
    desc: '找出熱門與離峰時段',
    explanation: '這張圖表用顏色呈現星期與時段的使用率。顏色越深代表越熱門，顏色越淺代表越空，適合用來找出尖峰、離峰與需要推廣的時段。'
  },
  revenue: {
    title: '營收記錄',
    desc: '查看收入變化與來源',
    explanation: '這張圖表顯示不同日期或時段實際產生的營收。除了看總金額，也要比較使用率與每小時收益，才能判斷哪些時段真正帶來較高的場地價值。'
  },
}
