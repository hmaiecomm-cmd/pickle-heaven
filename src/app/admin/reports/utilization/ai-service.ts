import type { UtilizationData, AIInsight } from './types'

export async function generateAIInsight(data: UtilizationData): Promise<AIInsight> {
  await new Promise((resolve) => setTimeout(resolve, 800))
  if (!data.hasData) {
    return {
      currentSituation: ['尚無足夠的場地使用資料進行分析。'],
      topOpportunity: '—',
      peakPricing: [],
      offPeakRecommendation: [],
      bestProduct: '—',
      targetAudience: '—',
      estimatedImpact: '—',
      trackingMetrics: [],
    }
  }
  return {
    currentSituation: ['目前平日下午使用率為 21%，平日晚間使用率已達 91%。'],
    topOpportunity: '平日下午（13:00～17:00）使用率僅 21%，為最值得填補的空場機會。',
    peakPricing: ['維持尖峰原價（18:00～22:00）', '不增加折扣', '對儲值會員優先開放預約'],
    offPeakRecommendation: ['推送 75 折離峰券給近 30 天曾於平日下午消費的 23 位會員', '另測試每人 NT$180 的 3 小時 Open Play'],
    bestProduct: '平日下午離峰暢打',
    targetAudience: '近 30 天曾於平日下午消費的會員（23 位）+ 新客散客',
    estimatedImpact: '若有 12 位會員完成離峰預約，預估可增加 NT$4,320 營收，提高離峰使用率約 12 個百分點。',
    trackingMetrics: ['離峰使用率（目標：增至 35～40%）', '平日下午預約轉換率（目標：≥50%）'],
  }
}
