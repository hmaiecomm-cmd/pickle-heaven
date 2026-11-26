export type ChartKeyMember = 'arpu' | 'retention' | 'conversion' | 'ltv' | 'cohort' | 'lifecycle' | 'revenue-by-segment' | 'growth-rate' | 'churn' | 'engagement'

export interface MemberKpi {
  value: number
  prev: number
  change: number | null
  trend?: 'up' | 'down' | 'stable'
}

export interface MemberInsightsRange {
  key: '7' | '30' | '90' | '180'
  from: string
  to: string
  days: number
  prevFrom: string
  prevTo: string
}

export interface ConversionFunnelStep {
  step: 'visitors' | 'signups' | 'firstBooking' | 'repeat' | 'vip'
  label: string
  count: number
  percentage: number
}

export interface DailyAction {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionCount: number
  targetSegment: string
  estimatedImpact: string
}

export interface MemberSegment {
  segment: 'new' | 'active' | 'atrisk' | 'vip' | 'inactive'
  label: string
  count: number
  revenue: number
  arpu: number
  engagement: number
}

export interface ChartDataMember {
  labels: string[]
  values: number[]
}

export interface MemberInsightsData {
  range: MemberInsightsRange
  venueName: string
  hasData: boolean
  kpi: {
    memberRevenue: MemberKpi
    arpu: MemberKpi
    retention: MemberKpi
    conversion: MemberKpi
  }
  conversionFunnel: ConversionFunnelStep[]
  segments: MemberSegment[]
  charts: Record<ChartKeyMember, ChartDataMember>
  dailyActions: DailyAction[]
}

export const CHART_META_MEMBER: Record<ChartKeyMember, { title: string; desc: string }> = {
  arpu: { title: '會員人均收益', desc: '追蹤人均收益趨勢' },
  retention: { title: '留存率曲線', desc: '會員留存與流失分析' },
  conversion: { title: '轉化漏斗', desc: '會員轉化各階段' },
  ltv: { title: '會員生命週期價值', desc: '長期價值評估' },
  cohort: { title: '隊列分析', desc: '按註冊時期的表現' },
  lifecycle: { title: '會員生命週期', desc: '不同階段會員分布' },
  'revenue-by-segment': { title: '分群營收', desc: '不同會員群的收入' },
  'growth-rate': { title: '成長率', desc: '會員數變化趨勢' },
  churn: { title: '流失率', desc: '會員流失分析' },
  engagement: { title: '活躍度', desc: '會員參與度指標' },
}
