/**
 * 功能訂閱系統服務函數
 */

import { mainPrisma } from '@/lib/db'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'

export async function getFeatureModules(available?: boolean): Promise<FeatureModuleDisplay[]> {
  const modules = await mainPrisma.featureModule.findMany({
    where: available !== undefined ? { isAvailable: available } : undefined,
    orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
  })

  return modules.map(parseFeatureModule)
}

export async function getFeatureModule(id: string): Promise<FeatureModuleDisplay | null> {
  const module = await mainPrisma.featureModule.findUnique({
    where: { id },
  })

  return module ? parseFeatureModule(module) : null
}

export async function getVenueSubscriptions(
  venueId: string
): Promise<(SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]> {
  const subscriptions = await mainPrisma.featureSubscription.findMany({
    where: { venueId },
    include: { featureModule: true },
    orderBy: { createdAt: 'asc' },
  })

  return subscriptions.map((sub) => ({
    id: sub.id,
    venueId: sub.venueId,
    featureModuleId: sub.featureModuleId,
    status: sub.status,
    startsAt: sub.startsAt,
    expiresAt: sub.expiresAt,
    daysRemaining: calculateDaysRemaining(sub.expiresAt),
    activatedAt: sub.activatedAt,
    autoRenew: sub.autoRenew,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    featureModule: parseFeatureModule(sub.featureModule),
  }))
}

export async function getSubscription(
  venueId: string,
  featureSlug: string
): Promise<(SubscriptionDisplay & { featureModule: FeatureModuleDisplay }) | null> {
  const subscription = await mainPrisma.featureSubscription.findFirst({
    where: {
      venueId,
      featureModule: { slug: featureSlug },
    },
    include: { featureModule: true },
  })

  if (!subscription) return null

  return {
    id: subscription.id,
    venueId: subscription.venueId,
    featureModuleId: subscription.featureModuleId,
    status: subscription.status,
    startsAt: subscription.startsAt,
    expiresAt: subscription.expiresAt,
    daysRemaining: calculateDaysRemaining(subscription.expiresAt),
    activatedAt: subscription.activatedAt,
    autoRenew: subscription.autoRenew,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    featureModule: parseFeatureModule(subscription.featureModule),
  }
}

export async function getPlatformPayments(venueId: string, limit: number = 10) {
  const payments = await mainPrisma.platformPayment.findMany({
    where: { venueId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return payments
}

/**
 * 狀態檢查函數
 */

export function isSubscriptionActive(status: string): boolean {
  return status === 'ACTIVE'
}

export function calculateDaysRemaining(expiresAt: Date): number {
  const now = new Date()
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, daysLeft)
}

export function getSubscriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: '建立中',
    ACTIVE: '已開通',
    EXPIRED: '已過期',
    CANCELLED: '已取消',
    PENDING_PAYMENT: '待付款',
  }
  return labels[status] || status
}

/**
 * 內部解析函數
 */

function parseFeatureModule(module: {
  id: string
  slug: string
  name: string
  tier: any
  description: string | null
  monthlyPrice: number
  yearlyPrice: number
  features: string | null
  isAvailable: boolean
  launchedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): FeatureModuleDisplay {
  return {
    id: module.id,
    slug: module.slug,
    name: module.name,
    tier: module.tier,
    description: module.description,
    monthlyPrice: module.monthlyPrice,
    yearlyPrice: module.yearlyPrice,
    features: module.features ? JSON.parse(module.features) : [],
    isAvailable: module.isAvailable,
    launchedAt: module.launchedAt,
    createdAt: module.createdAt,
    updatedAt: module.updatedAt,
  }
}
