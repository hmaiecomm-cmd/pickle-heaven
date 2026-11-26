export interface KPIMetric {
  value: number | string
  change?: number
  status?: 'up' | 'down' | 'neutral'
  label?: string
}

export interface UtilizationKPIs {
  overallRate: KPIMetric
  peakRate: KPIMetric
  offPeakRate: KPIMetric
  offPeakRevenueRatio: KPIMetric
  revpash: KPIMetric
  estimatedLoss: KPIMetric
  actualRevenue: KPIMetric
  additionalIncome: KPIMetric
}

export type ChartType =
  | 'heatmap'
  | 'pricing'
  | 'discount-impact'
  | 'revenue-compare'
  | 'product-opportunity'
  | 'cancellation-loss'
  | 'addon-revenue'
  | 'marketing-suggestions'

export interface HeatmapCell {
  dayIndex: number
  slotIndex: number
  rate: number
  revenue?: number
  time?: string
}

export interface PricingData {
  timeSlot: string
  price: number
  rate: number
  hourlyRevenue: number
}

export interface ProductRecommendation {
  id: string
  name: string
  targetGroup: string
  timeSlot: string
  suggestedPrice: number
  estimatedPeople: number
  estimatedRevenue: number
  salesChannel: string[]
  priority: number
}

export interface MarketingPlan {
  id: string
  name: string
  targetGroup: string
  timeSlot: string
  offer: string
  suggestedPrice: number
  pushTime: string
  channel: string
  conversionRate: number
  estimatedRevenue: number
  discountCost: number
  netRevenue: number
  priority: number
}

export interface AIInsight {
  currentSituation: string[]
  topOpportunity: string
  peakPricing: string[]
  offPeakRecommendation: string[]
  bestProduct: string
  targetAudience: string
  estimatedImpact: string
  trackingMetrics: string[]
}

export interface UtilizationData {
  range: { from: string; to: string; days: number }
  kpi: UtilizationKPIs
  heatmap: HeatmapCell[]
  timeSlots: string[]
  courts: Array<{ id: string; name: string }>
  pricingData: PricingData[]
  productRecommendations: ProductRecommendation[]
  marketingPlans: MarketingPlan[]
  demoMode: boolean
  hasData: boolean
}
