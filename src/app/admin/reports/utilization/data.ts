import 'server-only'
import type { Period } from '../report-data'
import type { UtilizationData } from './types'

export async function getUtilizationData(period: Period, courtId?: string, demoMode: boolean = false): Promise<UtilizationData> {
  const demoData: UtilizationData = {
    range: { from: period.from, to: period.to, days: period.days },
    kpi: {
      overallRate: { value: '54%', change: 5, status: 'up' },
      peakRate: { value: '91%' },
      offPeakRate: { value: '21%' },
      offPeakRevenueRatio: { value: '32%' },
      revpash: { value: 1200 },
      estimatedLoss: { value: 'NT$38,400' },
      actualRevenue: { value: 'NT$456,800' },
      additionalIncome: { value: 'NT$68,520' },
    },
    heatmap: [],
    timeSlots: [],
    courts: [{ id: 'a', name: 'A 場' }],
    pricingData: [],
    productRecommendations: [
      { id: '1', name: '平日下午離峰暢打', targetGroup: '平日白天族', timeSlot: '13:00-17:00', suggestedPrice: 180, estimatedPeople: 12, estimatedRevenue: 2160, salesChannel: ['LINE'], priority: 1 },
    ],
    marketingPlans: [
      { id: '1', name: '平日下午離峰快閃', targetGroup: '23位會員', timeSlot: '13:00-17:00', offer: '75折', suggestedPrice: 338, pushTime: '24小時前', channel: 'LINE', conversionRate: 0.52, estimatedRevenue: 4320, discountCost: 2016, netRevenue: 2304, priority: 1 },
    ],
    demoMode: demoMode || true,
    hasData: true,
  }
  return demoData
}
