// 會員經營與精準溝通 — 型別定義
export type OperationTheme =
  | 'off-peak-fill'
  | 'casual-to-prepay'
  | 'card-renewal'
  | 'dormant-recovery'
  | 'organizer-analysis'
  | 'noshowm-manage'
  | 'line-binding'
  | 'retention'
  | 'high-value'
  | 'member-segmentation'

export const OPERATION_THEME_LABELS: Record<OperationTheme, { title: string; subtitle: string }> = {
  'off-peak-fill': { title: '離峰時段補位', subtitle: '找出適合推播的會員，補位離峰空場' },
  'casual-to-prepay': { title: '臨打客轉儲值', subtitle: '識別高潛力臨打客，轉換為儲值會員' },
  'card-renewal': { title: '季卡續約提醒', subtitle: '提前提醒並激勵續約，減少流失' },
  'dormant-recovery': { title: '沉睡會員喚回', subtitle: '根據過去偏好喚醒不活躍會員' },
  'organizer-analysis': { title: '主揪帶客與團員經營', subtitle: '識別主揪會員並提供激勵方案' },
  'noshowm-manage': { title: 'No-show 與取消管理', subtitle: '降低 No-show 率，改善場館利用率' },
  'line-binding': { title: 'LINE 綁定率提升', subtitle: '提高會員 LINE 綁定比例，啟用精準推播' },
  'retention': { title: '會員回訪率提升', subtitle: '提高首次消費會員的二次消費率' },
  'high-value': { title: '高價值會員經營', subtitle: '鎖定高消費會員，提供優先服務' },
  'member-segmentation': { title: '會員分群與精準推播', subtitle: '按分群精準推送優惠與訊息' },
}

export type DateRangePreset = '7' | '30' | '90' | '180' | 'custom'

export interface OperationRecommendation {
  theme: OperationTheme
  currentStatus: string
  possibleCauses: string[]
  suggestedActions: string[]
  suggestedPromotions?: { name: string; discount: number; condition: string }[]
  targetMembers: string
  trackedMetrics: string[]
}

export type MemberIdentity = 'trial' | 'casual' | 'regular' | 'prepaid' | 'monthly' | 'seasonal' | 'organizer'
export type MemberPreference = 'weekday-morning' | 'weekday-evening' | 'weekend-morning' | 'weekend-evening'
export type MemberStatus = 'low-balance' | 'card-expiring' | 'dormant' | 'high-cancel' | 'high-noshow' | 'line-unbound'

export interface MemberLabel {
  identity?: MemberIdentity
  preferences: MemberPreference[]
  status: MemberStatus[]
}

export interface MemberKpi {
  value: number
  prev: number
  change: number | null
  trend?: 'up' | 'down' | 'stable'
}

export interface OperationKpis {
  communicableMembers: MemberKpi
  lineBindRate: MemberKpi
  active30d: MemberKpi
  highFreqCasual: MemberKpi
  prepaidMembers: MemberKpi
  cardExpiring14d: MemberKpi
  dormantMembers: MemberKpi
  organizerMembers: MemberKpi
}

export interface MemberOperationsSummary {
  theme: OperationTheme
  range: { from: string; to: string; days: number }
  kpis: OperationKpis
  estimatedRevenue?: number
}

export type OperationChart = 'timeslot-heatmap' | 'off-peak-trend' | 'casual-distribution' | 'retention-funnel' | 'card-renewal-trend' | 'dormant-distribution' | 'organizer-ranking' | 'noshowm-trend'

export interface MemberProfile {
  userId: string
  name: string
  labels: MemberLabel
}

export interface MemberRecommendation extends MemberProfile {
  triggerReason: string
  suggestedAction: string
  lineMessageTemplate?: string
}

export interface DailyActionPlan {
  priority: 'high' | 'medium' | 'low'
  title: string
  targetCount: number
  members: MemberRecommendation[]
}

export interface OperationFilters {
  theme: OperationTheme
  range: { key: '7' | '30' | '90' | '180'; from: string; to: string; days: number }
  venues: string[]
  memberTypes: MemberIdentity[]
}

export interface OperationData {
  filters: OperationFilters
  hasData: boolean
  summary: MemberOperationsSummary
  dailyActions: DailyActionPlan[]
  memberList: MemberRecommendation[]
  recommendation?: OperationRecommendation
}
