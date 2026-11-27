// 新版會員經營頁面類型定義

export type MemberSegmentType =
  | 'all'
  | 'no-show-cancel'
  | 'line-binding'
  | 'retention'
  | 'dormant-recovery'
  | 'high-value'
  | 'member-segmentation'

export interface MemberSegmentLabel {
  title: string
  subtitle: string
}

export const MEMBER_SEGMENT_LABELS: Record<MemberSegmentType, MemberSegmentLabel> = {
  'all': { title: '全部會員', subtitle: '概覽所有會員情況' },
  'no-show-cancel': { title: 'No-show 與取消管理', subtitle: '降低 No-show 率與取消率' },
  'line-binding': { title: 'LINE 綁定率提升', subtitle: '提高 LINE 推播成效' },
  'retention': { title: '會員回訪率提升', subtitle: '提升會員回訪頻率' },
  'dormant-recovery': { title: '沉睡會員喚回', subtitle: '重新激活沉睡會員' },
  'high-value': { title: '高價值會員經營', subtitle: '提升高端會員滿意度' },
  'member-segmentation': { title: '會員分群與精準推播', subtitle: '分析會員特徵與行為' }
}

export interface KpiMetric {
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
  color: 'green' | 'red' | 'blue' | 'orange' | 'gray'
}

export interface ChartConfig {
  id: string
  title: string
  type: 'funnel' | 'bar' | 'line' | 'cohort' | 'heatmap'
  description: string
}

export interface DemoContent {
  title: string
  status: string
  causes: string[]
  actions: string[]
  metrics: string[]
}
