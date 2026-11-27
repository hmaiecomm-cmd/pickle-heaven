import 'server-only'
import type { Period } from '../report-data'
import type { UtilizationData } from './types'

const COURT_A_DATA: UtilizationData = {
  range: { from: '', to: '', days: 30 },
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
  courts: [
    { id: 'a', name: 'A 場' },
    { id: 'b', name: 'B 場' },
  ],
  pricingData: [],
  productRecommendations: [
    { id: '1', name: '平日下午離峰暢打', targetGroup: '平日白天族', timeSlot: '13:00-17:00', suggestedPrice: 180, estimatedPeople: 12, estimatedRevenue: 2160, salesChannel: ['LINE'], priority: 1 },
  ],
  marketingPlans: [
    { id: '1', name: '平日下午離峰快閃', targetGroup: '23位會員', timeSlot: '13:00-17:00', offer: '75折', suggestedPrice: 338, pushTime: '24小時前', channel: 'LINE', conversionRate: 0.52, estimatedRevenue: 4320, discountCost: 2016, netRevenue: 2304, priority: 1 },
  ],
  demoMode: true,
  hasData: true,
}

const COURT_B_DATA: UtilizationData = {
  range: { from: '', to: '', days: 30 },
  kpi: {
    overallRate: { value: '48%', change: -2, status: 'down' },
    peakRate: { value: '78%' },
    offPeakRate: { value: '28%' },
    offPeakRevenueRatio: { value: '45%' },
    revpash: { value: 950 },
    estimatedLoss: { value: 'NT$52,200' },
    actualRevenue: { value: 'NT$384,500' },
    additionalIncome: { value: 'NT$45,300' },
  },
  heatmap: [],
  timeSlots: [],
  courts: [
    { id: 'a', name: 'A 場' },
    { id: 'b', name: 'B 場' },
  ],
  pricingData: [],
  productRecommendations: [
    { id: '2', name: '週末進階課程', targetGroup: '進階球友', timeSlot: '09:00-12:00', suggestedPrice: 450, estimatedPeople: 8, estimatedRevenue: 3600, salesChannel: ['官網'], priority: 1 },
  ],
  marketingPlans: [
    { id: '2', name: '週末會員優惠', targetGroup: '18位會員', timeSlot: '09:00-12:00', offer: '8折', suggestedPrice: 360, pushTime: '48小時前', channel: 'LINE', conversionRate: 0.44, estimatedRevenue: 2880, discountCost: 1440, netRevenue: 1440, priority: 1 },
  ],
  demoMode: true,
  hasData: true,
}

export async function getUtilizationData(period: Period, courtId?: string, demoMode: boolean = false): Promise<UtilizationData> {
  let baseData = COURT_A_DATA

  if (courtId === 'b') {
    baseData = COURT_B_DATA
  } else if (courtId === 'a' || !courtId) {
    baseData = COURT_A_DATA
  }

  const result: UtilizationData = {
    ...baseData,
    range: { from: period.from, to: period.to, days: period.days },
    demoMode: demoMode || true,
  }

  return result
}
