// 圖表類型與解說
export type OperationChartType =
  | 'member-segmentation-count'
  | 'member-segmentation-revenue'
  | 'member-activity-trend'
  | 'new-member-trend'
  | 'member-retention'
  | 'member-conversion-funnel'
  | 'casual-to-prepay-rate'
  | 'card-renewal-rate'
  | 'dormant-distribution'
  | 'last-consumption-date'
  | 'organizer-ranking'
  | 'line-binding-rate'
  | 'line-push-conversion'
  | 'timeslot-preference'
  | 'court-preference'
  | 'consumption-frequency'
  | 'average-spending'
  | 'revenue-pareto'
  | 'promotion-effectiveness'
  | 'high-value-distribution'

export const CHART_LABELS: Record<OperationChartType, { title: string; description: string }> = {
  'member-segmentation-count': {
    title: '會員分群人數',
    description: '這張圖表顯示不同會員類型的人數，例如單次客、儲值會員、季卡會員與沉睡會員。可以協助管理者判斷目前會員結構與最需要經營的群體。'
  },
  'member-segmentation-revenue': {
    title: '各會員分群營收',
    description: '這張圖表比較不同會員群帶來的營收。人數較少但營收較高的會員群，通常是儲值、續約與專屬服務的優先對象。'
  },
  'member-activity-trend': {
    title: '會員活躍度趨勢',
    description: '這張圖表顯示會員在不同期間的預約、消費與回訪變化。若活躍會員下降，即使會員總數增加，也可能代表會員經營品質正在變差。'
  },
  'new-member-trend': {
    title: '新會員成長趨勢',
    description: '這張圖表顯示每日或每月新加入會員數，可以觀察行銷活動是否成功帶來新客，也要搭配回訪率判斷會員品質。'
  },
  'member-retention': {
    title: '會員回訪率',
    description: '這張圖表顯示會員首次消費後再次回來的比例。回訪率偏低時，建議檢查首次消費後的提醒、優惠與服務體驗。'
  },
  'member-conversion-funnel': {
    title: '會員轉換漏斗',
    description: '這張圖表顯示會員從第一次接觸、首次來場、第二次消費，到儲值或購買季卡的轉換過程。人數下降最大的階段，就是最需要改善的經營環節。'
  },
  'casual-to-prepay-rate': {
    title: '單次客轉儲值',
    description: '這張圖表顯示單次消費會員轉換成儲值會員的比例。近 30 天消費兩到三次但尚未儲值的會員，通常是最值得優先推薦的對象。'
  },
  'card-renewal-rate': {
    title: '季卡續約率',
    description: '這張圖表顯示季卡會員到期後的續約比例。續約率下降時，應檢查使用頻率、固定時段價值與到期前提醒是否足夠。'
  },
  'dormant-distribution': {
    title: '沉睡會員分布',
    description: '這張圖表顯示不同天數未消費的會員人數。超過 21 天或 45 天未消費的會員，應依過去時段與消費金額安排不同喚回方式。'
  },
  'last-consumption-date': {
    title: '會員最後消費日期',
    description: '這張圖表按最後消費日期分組顯示會員數量。可快速識別沉睡會員群體與其消費間隔，作為喚回策略的基礎。'
  },
  'organizer-ranking': {
    title: '主揪帶客排行',
    description: '這張圖表顯示固定訂場與帶來團員最多的主揪會員。主揪是球館重要的自然推廣者，適合提供推薦獎勵與優先訂場權。'
  },
  'line-binding-rate': {
    title: 'LINE 綁定率',
    description: '這張圖表顯示會員完成 LINE 綁定的比例。綁定率越高，越能針對空場、續約與回訪機會進行精準溝通。'
  },
  'line-push-conversion': {
    title: 'LINE 推播轉換率',
    description: '這張圖表比較訊息發送、開啟、點擊與實際預約或儲值的人數，可以判斷哪些推播內容真正帶來營收。'
  },
  'timeslot-preference': {
    title: '會員偏好時段',
    description: '這張圖表顯示會員最常預約的星期與時間。可以用來安排離峰優惠，也能避免把折扣發給原本就會購買尖峰時段的會員。'
  },
  'court-preference': {
    title: '會員偏好球場',
    description: '這張圖表顯示會員最常選擇的場地。可用於場地營運優化、動態定價與設備維護排程規劃。'
  },
  'consumption-frequency': {
    title: '會員消費頻率',
    description: '這張圖表顯示會員在期間內消費幾次。高頻單次客適合轉換儲值，低頻會員則適合先設計回訪誘因。'
  },
  'average-spending': {
    title: '會員平均消費金額',
    description: '這張圖表比較不同會員類型的平均消費金額，可以協助管理者安排方案價格、會員分級與高價值服務。'
  },
  'revenue-pareto': {
    title: '會員營收 Pareto 分析',
    description: '這張圖表按營收排序顯示會員佔比。通常 20% 高價值會員貢獻 80% 營收，應成為重點經營與留住的對象。'
  },
  'promotion-effectiveness': {
    title: '優惠活動轉換成效',
    description: '這張圖表比較不同優惠方案的推送人數、轉換人數與轉換率。可識別最有效的優惠策略與最有潛力的會員群。'
  },
  'high-value-distribution': {
    title: '高價值會員分布',
    description: '這張圖表顯示高消費會員的身份、時段與偏好分布。用於設計 VIP 專屬優惠、提升滿意度與推薦度。'
  }
}

// 圖表示範數據
export interface ChartDataPoint {
  label: string
  value: number
  percentage?: number
}

export function generateChartData(chartType: OperationChartType): ChartDataPoint[] {
  const mockData: Record<OperationChartType, ChartDataPoint[]> = {
    'member-segmentation-count': [
      { label: '單次客', value: 45, percentage: 37.5 },
      { label: '儲值會員', value: 32, percentage: 26.7 },
      { label: '季卡會員', value: 28, percentage: 23.3 },
      { label: '沉睡會員', value: 15, percentage: 12.5 }
    ],
    'member-segmentation-revenue': [
      { label: '單次客', value: 18000, percentage: 15 },
      { label: '儲值會員', value: 42000, percentage: 35 },
      { label: '季卡會員', value: 48000, percentage: 40 },
      { label: '沉睡會員', value: 12000, percentage: 10 }
    ],
    'member-activity-trend': [
      { label: '第 1 週', value: 68 },
      { label: '第 2 週', value: 72 },
      { label: '第 3 週', value: 65 },
      { label: '第 4 週', value: 71 }
    ],
    'new-member-trend': [
      { label: '1 月', value: 12 },
      { label: '2 月', value: 18 },
      { label: '3 月', value: 15 },
      { label: '4 月', value: 22 }
    ],
    'member-retention': [
      { label: '首次消費後回訪', value: 42.5, percentage: 42.5 },
      { label: '未回訪', value: 57.5, percentage: 57.5 }
    ],
    'member-conversion-funnel': [
      { label: '首次接觸', value: 150 },
      { label: '首次到場', value: 120 },
      { label: '第二次消費', value: 85 },
      { label: '儲值轉換', value: 32 },
      { label: '季卡購買', value: 18 }
    ],
    'casual-to-prepay-rate': [
      { label: '轉換為儲值', value: 18.7, percentage: 18.7 },
      { label: '未轉換', value: 81.3, percentage: 81.3 }
    ],
    'card-renewal-rate': [
      { label: '續約', value: 68, percentage: 68 },
      { label: '未續約', value: 32, percentage: 32 }
    ],
    'dormant-distribution': [
      { label: '21-30 天', value: 8 },
      { label: '31-45 天', value: 12 },
      { label: '46-60 天', value: 7 },
      { label: '60+ 天', value: 5 }
    ],
    'last-consumption-date': [
      { label: '1-7 天前', value: 45 },
      { label: '8-14 天前', value: 32 },
      { label: '15-30 天前', value: 28 },
      { label: '30+ 天前', value: 15 }
    ],
    'organizer-ranking': [
      { label: '何主揪', value: 8, percentage: 15 },
      { label: '詹大組', value: 6, percentage: 11 },
      { label: '林小傑', value: 5, percentage: 9 },
      { label: '其他', value: 36, percentage: 65 }
    ],
    'line-binding-rate': [
      { label: 'LINE 已綁定', value: 82, percentage: 68 },
      { label: 'LINE 未綁定', value: 38, percentage: 32 }
    ],
    'line-push-conversion': [
      { label: '發送', value: 320 },
      { label: '開啟', value: 256 },
      { label: '點擊', value: 185 },
      { label: '轉換', value: 48 }
    ],
    'timeslot-preference': [
      { label: '平日早晨', value: 15, percentage: 12.5 },
      { label: '平日下午', value: 18, percentage: 15 },
      { label: '平日晚間', value: 42, percentage: 35 },
      { label: '假日', value: 45, percentage: 37.5 }
    ],
    'court-preference': [
      { label: '球場 1', value: 48, percentage: 40 },
      { label: '球場 2', value: 36, percentage: 30 },
      { label: '球場 3', value: 24, percentage: 20 },
      { label: '球場 4', value: 12, percentage: 10 }
    ],
    'consumption-frequency': [
      { label: '1 次', value: 35, percentage: 29 },
      { label: '2-3 次', value: 42, percentage: 35 },
      { label: '4-6 次', value: 28, percentage: 23 },
      { label: '7+ 次', value: 15, percentage: 13 }
    ],
    'average-spending': [
      { label: '單次客', value: 400 },
      { label: '儲值會員', value: 1312 },
      { label: '季卡會員', value: 1714 },
      { label: '沉睡會員', value: 800 }
    ],
    'revenue-pareto': [
      { label: '前 20% 會員', value: 96000, percentage: 80 },
      { label: '其他 80% 會員', value: 24000, percentage: 20 }
    ],
    'promotion-effectiveness': [
      { label: '下午 75 折', value: 42, percentage: 68 },
      { label: '早晚套票 8 折', value: 28, percentage: 55 },
      { label: '儲值贈送', value: 32, percentage: 72 },
      { label: '沉睡優惠', value: 12, percentage: 38 }
    ],
    'high-value-distribution': [
      { label: '儲值會員', value: 18, percentage: 56 },
      { label: '季卡會員', value: 14, percentage: 44 }
    ]
  }

  return mockData[chartType] || []
}
