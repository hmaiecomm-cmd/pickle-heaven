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

export const FUNNEL_EXPLANATION = '會員轉換漏斗顯示球友從第一次接觸、首次來場，到再次消費、儲值與購買季卡的轉變。每一層人數下降的地方，就是最需要改善的經營環節。'

export const CHART_META_MEMBER: Record<ChartKeyMember, { title: string; desc: string; explanation: string }> = {
  arpu: {
    title: '會員人均收益',
    desc: '追蹤人均收益趨勢',
    explanation: '這張圖表顯示平均每位會員為球館帶來的營收。數值上升代表會員的平均消費金額在增加，可能來自更多的場地預約或更高的儲值金額。'
  },
  retention: {
    title: '留存率曲線',
    desc: '會員留存與流失分析',
    explanation: '這張圖表追蹤多少會員在每個時間點仍在活躍。留存率越高表示會員黏著度越好，流失率高的時期應檢查是否有營運變化或不滿意的情況。'
  },
  conversion: {
    title: '會員轉化率',
    desc: '首次來場到重複消費的比例',
    explanation: '這張圖表顯示訪客轉化為會員、會員首次消費、重複消費等各階段的轉化率。轉化率低的階段是改善的重點，可考慮推廣活動或優惠方案。'
  },
  ltv: {
    title: '會員生命週期價值',
    desc: '長期價值評估',
    explanation: '這張圖表估算每位會員在整個活躍期間的總貢獻。LTV 高的會員群是重點保留對象；LTV 低的會員群應檢查消費行為並尋求提升機會。'
  },
  cohort: {
    title: '隊列分析',
    desc: '按註冊時期的表現',
    explanation: '這張圖表按加入月份分組，比較不同時期註冊的會員的留存與消費表現。可以看出哪些時期的會員品質較高，以及營運變化對新會員的影響。'
  },
  lifecycle: {
    title: '會員生命週期',
    desc: '不同階段會員分布',
    explanation: '這張圖表顯示會員在新客、活躍、風險、VIP、沉睡等不同階段的分布。重點應放在增加活躍會員數量，並對風險與沉睡會員進行喚回活動。'
  },
  'revenue-by-segment': {
    title: '分群營收',
    desc: '不同會員群的收入',
    explanation: '這張圖表比較各會員群（新客、活躍、VIP 等）帶來的營收。VIP 會員群貢獻高時應加強維護關係；新客轉化率低時應設計導入課程或優惠。'
  },
  'growth-rate': {
    title: '會員成長趨勢',
    desc: '會員數變化趨勢',
    explanation: '這張圖表顯示每天或每週新增會員的數量。成長速率穩定代表營運穩健；快速成長期應準備好客戶服務資源；停滯期應檢查行銷與推廣策略。'
  },
  churn: {
    title: '流失率分析',
    desc: '會員流失分析',
    explanation: '這張圖表顯示每個時期會員的流失比例。高流失率可能表示服務滿意度、價格接受度或季節性變化等問題，需要深入分析與改善。'
  },
  engagement: {
    title: '會員活躍度',
    desc: '會員參與度指標',
    explanation: '這張圖表衡量會員的預約頻率、消費金額、使用時段等活躍度指標。活躍度高的會員是重點維護對象；活躍度低的會員應推送針對性的優惠與課程推薦。'
  },
}
