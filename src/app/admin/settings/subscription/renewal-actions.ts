'use server'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/admin-auth'

/**
 * 自動續約處理
 * - 檢查待續約的訂閱
 * - 驗證支付方式
 * - 建立新的 PlatformPayment
 * - 更新訂閱狀態
 */

export async function processRenewal(subscriptionId: string) {
  const ctx = await requirePermission('settings')

  if (!ctx.venueId) {
    throw new Error('無法識別場館，請聯絡管理員')
  }

  const subscription = await prisma.featureSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      venue: true,
      featureModule: true,
      payment: true,
    },
  })

  if (!subscription) {
    throw new Error('訂閱不存在')
  }

  if (subscription.venue.id !== ctx.venueId) {
    throw new Error('無權訪問此訂閱')
  }

  // 檢查是否有有效支付方式
  const paymentMethod = await prisma.venuePaymentMethod.findFirst({
    where: {
      venueId: subscription.venueId,
      isActive: true,
    },
  })

  if (!paymentMethod) {
    throw new Error('尚未綁定支付方式，無法自動續約')
  }

  // 建立新的續約支付記錄
  const amount = subscription.featureModule.yearlyPrice

  const newPayment = await prisma.platformPayment.create({
    data: {
      venueId: subscription.venueId,
      amount,
      status: 'PENDING',
      provider: paymentMethod.provider,
      subscriptionIds: subscriptionId,
    },
  })

  // 更新訂閱資訊
  const newExpiresAt = new Date(subscription.expiresAt)
  newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1)

  const updated = await prisma.featureSubscription.update({
    where: { id: subscriptionId },
    data: {
      platformPaymentId: newPayment.id,
      nextRenewalAt: null,
      renewalAttempts: subscription.renewalAttempts + 1,
      renewalFailReason: null,
      expiresAt: newExpiresAt,
      status: 'PENDING_PAYMENT',
    },
    include: {
      featureModule: true,
    },
  })

  return {
    success: true,
    subscriptionId: updated.id,
    paymentId: newPayment.id,
    amount,
    renewalDate: updated.expiresAt,
  }
}

/**
 * 設定自動續約
 */
export async function enableAutoRenewal(subscriptionId: string) {
  const ctx = await requirePermission('settings')

  if (!ctx.venueId) {
    throw new Error('無法識別場館，請聯絡管理員')
  }

  const subscription = await prisma.featureSubscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    throw new Error('訂閱不存在')
  }

  if (subscription.venueId !== ctx.venueId) {
    throw new Error('無權訪問此訂閱')
  }

  // 檢查是否有支付方式
  const paymentMethod = await prisma.venuePaymentMethod.findFirst({
    where: {
      venueId: subscription.venueId,
      isActive: true,
    },
  })

  if (!paymentMethod) {
    throw new Error('請先綁定支付方式')
  }

  const nextRenewalAt = new Date(subscription.expiresAt)
  nextRenewalAt.setDate(nextRenewalAt.getDate() - 7) // 到期前 7 天

  return await prisma.featureSubscription.update({
    where: { id: subscriptionId },
    data: {
      autoRenew: true,
      nextRenewalAt,
    },
  })
}

/**
 * 關閉自動續約
 */
export async function disableAutoRenewal(subscriptionId: string) {
  const ctx = await requirePermission('settings')

  if (!ctx.venueId) {
    throw new Error('無法識別場館，請聯絡管理員')
  }

  const subscription = await prisma.featureSubscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    throw new Error('訂閱不存在')
  }

  if (subscription.venueId !== ctx.venueId) {
    throw new Error('無權訪問此訂閱')
  }

  return await prisma.featureSubscription.update({
    where: { id: subscriptionId },
    data: {
      autoRenew: false,
      nextRenewalAt: null,
    },
  })
}

/**
 * 綁定支付方式
 */
export async function bindPaymentMethod(data: {
  provider: string
  cardTokenResult?: string | null
  cardLastFour?: string | null
  cardholderName?: string | null
  isDefault?: boolean
}) {
  const ctx = await requirePermission('settings')

  if (!ctx.venueId) {
    throw new Error('無法識別場館，請聯絡管理員')
  }

  const existing = await prisma.venuePaymentMethod.findFirst({
    where: {
      venueId: ctx.venueId,
      provider: data.provider,
    },
  })

  if (existing) {
    return await prisma.venuePaymentMethod.update({
      where: { id: existing.id },
      data: {
        cardTokenResult: data.cardTokenResult === undefined ? undefined : data.cardTokenResult,
        cardLastFour: data.cardLastFour === undefined ? undefined : data.cardLastFour,
        cardholderName: data.cardholderName === undefined ? undefined : data.cardholderName,
        isDefault: data.isDefault ?? true,
      },
    })
  }

  return await prisma.venuePaymentMethod.create({
    data: {
      venueId: ctx.venueId,
      provider: data.provider,
      cardTokenResult: data.cardTokenResult ?? null,
      cardLastFour: data.cardLastFour ?? null,
      cardholderName: data.cardholderName ?? null,
      isDefault: data.isDefault ?? true,
      isActive: true,
    },
  })
}

/**
 * 移除支付方式
 */
export async function removePaymentMethod(paymentMethodId: string) {
  const ctx = await requirePermission('settings')

  const method = await prisma.venuePaymentMethod.findUnique({
    where: { id: paymentMethodId },
  })

  if (!method || method.venueId !== ctx.venueId) {
    throw new Error('無權刪除此支付方式')
  }

  return await prisma.venuePaymentMethod.delete({
    where: { id: paymentMethodId },
  })
}

/**
 * 設定預設支付方式
 */
export async function setDefaultPaymentMethod(paymentMethodId: string) {
  const ctx = await requirePermission('settings')

  const method = await prisma.venuePaymentMethod.findUnique({
    where: { id: paymentMethodId },
  })

  if (!method || method.venueId !== ctx.venueId) {
    throw new Error('無權變更此支付方式')
  }

  // 移除舊的預設
  await prisma.venuePaymentMethod.updateMany({
    where: {
      venueId: ctx.venueId,
      isDefault: true,
    },
    data: { isDefault: false },
  })

  // 設定新的預設
  return await prisma.venuePaymentMethod.update({
    where: { id: paymentMethodId },
    data: { isDefault: true },
  })
}
