import type { ChartKeyMember } from './member-insights-types'

export interface ChartConfig {
  key: ChartKeyMember
  title: string
  description: string
  purpose: string // 約 50 中文字
  evaluation: (data: any) => string // 根據數據生成評估
}

export const CHART_CONFIGS: Record<ChartKeyMember, ChartConfig> = {
  arpu: {
    key: 'arpu',
    title: '會員平均收益',
    description: '會員人均營收趨勢',
    purpose: '此圖表用於觀察每位會員在分析期間帶來的平均營收，協助管理者判斷會員消費價值、方案成效與後續提升客單價的經營方向。',
    evaluation: (data) => {
      if (data.charts.arpu.values[0] > data.charts.arpu.values[1]) {
        return `會員平均收益上升 ${data.kpi.arpu.change}%，表示會員消費價值在提升，建議繼續執行目前的會員激勵策略。`
      }
      return `會員平均收益下降 ${Math.abs(data.kpi.arpu.change)}%，可能表示會員消費頻率或客單價下降，建議檢視銷售方案或會員推薦策略。`
    },
  },

  retention: {
    key: 'retention',
    title: '留存率曲線',
    description: '會員留存與流失分析',
    purpose: '此圖表追蹤會員在不同時期的留存情況，數值越高表示會員黏著度越好，快速下降表示在某個時期出現了會員流失風險。建議檢視該時期的營運變化。',
    evaluation: (data) => {
      const retention = data.charts.retention.values
      const rate = retention[retention.length - 1]
      return `四週留存率為 ${rate}%，較前期 ${data.kpi.retention.prev}% ${data.kpi.retention.change > 0 ? '上升' : '下降'} ${Math.abs(data.kpi.retention.change)}%。建議加強會員回訪提醒與續約管理。`
    },
  },

  conversion: {
    key: 'conversion',
    title: '會員轉換漏斗',
    description: '訪客到會員的轉換流程',
    purpose: '此圖表展示訪客轉化為會員、首次消費、重複消費等各階段的進度，最大流失處即為改善重點。可透過優化流程、推廣活動或優惠方案來提升轉化率。',
    evaluation: (data) => {
      const funnel = data.conversionFunnel
      const weakestRate = Math.min(...funnel.filter((s: any) => s.step !== 'visitors').map((s: any) => s.percentage))
      return `會員轉化率為 ${data.kpi.conversion.value}%，較前期 ${data.kpi.conversion.prev}% ${data.kpi.conversion.change > 0 ? '上升' : '下降'} ${Math.abs(data.kpi.conversion.change)}%。漏斗最大流失處轉化率僅 ${weakestRate}%，建議優化該環節。`
    },
  },

  ltv: {
    key: 'ltv',
    title: '會員生命週期價值',
    description: '不同會員類型的長期價值',
    purpose: '此圖表估算不同會員類型在整個活躍期間的總貢獻，LTV 越高的會員是重點保留對象，應強化服務與提高滿意度。LTV 低的會員需檢視消費行為並尋求提升機會。',
    evaluation: (data) => {
      return '不同會員類型的生命週期價值差異顯著，高價值會員 LTV 為新會員的 10 倍以上。建議針對高價值會員提供專屬服務，並設計新會員升級方案。'
    },
  },

  cohort: {
    key: 'cohort',
    title: '留存率世代分析',
    description: '按加入時期的會員表現',
    purpose: '此圖表按會員加入月份分組，對比不同時期新加入會員的留存與消費表現。可看出營運變化對新會員品質的影響，以及哪些時期的會員更有留存價值。',
    evaluation: (data) => {
      return '世代分析可識別不同時期會員的品質差異，建議針對低留存的世代分析營運變化原因，並調整會員導入與初期激勵策略。'
    },
  },

  lifecycle: {
    key: 'lifecycle',
    title: '會員生命週期',
    description: '會員在各階段的分布狀況',
    purpose: '此圖表展示會員在新客、活躍、風險、VIP、沉睡等不同生命週期階段的分布，重點應放在增加活躍會員佔比，並對風險與沉睡會員執行針對性喚回活動。',
    evaluation: (data) => {
      const lifecycle = data.charts.lifecycle.values
      const activeRate = (lifecycle[1] / lifecycle.reduce((a: number, b: number) => a + b, 0)) * 100
      return `活躍會員佔比約 ${Math.round(activeRate)}%，沉睡與風險會員佔比達 ${Math.round(100 - activeRate)}%。建議執行會員分層管理與喚回活動。`
    },
  },

  'revenue-by-segment': {
    key: 'revenue-by-segment',
    title: '分群營收結構',
    description: '不同會員群的收入分布',
    purpose: '此圖表比較各會員群（新客、活躍、VIP 等）帶來的營收，VIP 會員群貢獻高時應加強維護關係；新客轉化率低時應設計導入課程或優惠，提升轉化與客單價。',
    evaluation: (data) => {
      const segments = data.segments
      const topSegment = segments.reduce((max: any, curr: any) => (curr.revenue > max.revenue ? curr : max))
      return `${topSegment.label}是營收最大來源，貢獻度最高。建議根據不同會員群特性制定差異化經營策略，開發新營收機會。`
    },
  },

  'growth-rate': {
    key: 'growth-rate',
    title: '會員成長趨勢',
    description: '新增會員數的變化趨勢',
    purpose: '此圖表顯示每週或每月新增會員的數量與趨勢，成長速率穩定代表營運穩健，快速成長期應準備好客戶服務資源，停滯期應檢查行銷與推廣策略。',
    evaluation: (data) => {
      return '會員成長趨勢穩定，為持續執行推廣的信號。若成長停滯，建議評估目前的行銷投入和效果，考慮調整推廣策略或增加推廣預算。'
    },
  },

  churn: {
    key: 'churn',
    title: '流失率分析',
    description: '會員流失比例的變化',
    purpose: '此圖表顯示不同時期會員的流失比例，高流失率可能表示服務滿意度、價格接受度或季節性變化等問題，需深入分析並改善核心問題以降低流失。',
    evaluation: (data) => {
      const churn = data.charts.churn.values
      const latestChurn = churn[churn.length - 1]
      return `最近流失率為 ${latestChurn}%，表示有約 ${latestChurn}% 的會員停止活躍。建議調查流失原因並執行喚回策略。`
    },
  },

  engagement: {
    key: 'engagement',
    title: '會員活躍度',
    description: '會員參與度指標分布',
    purpose: '此圖表衡量會員的預約頻率、消費金額、使用時段等活躍度指標，活躍度高的會員是重點維護對象，活躍度低的會員應推送針對性優惠與課程推薦以提升活躍度。',
    evaluation: (data) => {
      return '根據活躍度指標，可識別出高價值會員與潛在流失風險會員，建議對不同群體執行差異化運營策略。'
    },
  },
}

export const CHART_SELECT_OPTIONS = [
  { key: 'arpu', label: '會員平均收益' },
  { key: 'retention', label: '留存率曲線' },
  { key: 'conversion', label: '會員轉換漏斗' },
  { key: 'ltv', label: '會員生命週期價值' },
  { key: 'cohort', label: '留存率世代分析' },
  { key: 'lifecycle', label: '會員生命週期' },
  { key: 'revenue-by-segment', label: '分群營收結構' },
  { key: 'growth-rate', label: '會員成長趨勢' },
  { key: 'churn', label: '流失率分析' },
  { key: 'engagement', label: '會員活躍度' },
] as const
