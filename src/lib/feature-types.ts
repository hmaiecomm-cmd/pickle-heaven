/**
 * 功能訂閱系統類型定義
 */

import type { SubscriptionStatus, FeatureTier } from '@prisma/client'

export interface FeatureModuleDisplay {
  id: string
  slug: string
  name: string
  tier: FeatureTier
  description: string | null
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  isAvailable: boolean
  launchedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SubscriptionDisplay {
  id: string
  venueId: string
  featureModuleId: string
  status: SubscriptionStatus
  startsAt: Date
  expiresAt: Date
  daysRemaining: number
  activatedAt: Date | null
  autoRenew: boolean
  createdAt: Date
  updatedAt: Date
  featureModule: FeatureModuleDisplay
}

export interface PaymentConfigDisplay {
  environment: 'test' | 'production'
  provider: string
  configured: boolean
  lastUpdated: Date | null
}

export interface FeatureSubscriptionWithModule extends SubscriptionDisplay {
  featureModule: FeatureModuleDisplay
}
