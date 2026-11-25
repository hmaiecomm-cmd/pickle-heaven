/**
 * 功能訂閱生命週期 Server Actions
 * 包括：購買、續約、取消、自動續約、過期檢查
 */

'use server'

import { revalidatePath } from 'next/cache'
import { mainPrisma } from '@/lib/db'
import { pagePermission } from '@/lib/admin-auth'
import type { SubscriptionStatus } from '@prisma/client'

export type AdminResult<T = unknown> = { success: boolean; message: string; data?: T }

/**
 * 建立新的功能訂閱
 * 步驟：1. 建立 FeatureSubscription 2. 建立 PlatformPayment 3. 初始化支付
 */
export async function createFeatureSubscription(
  venueId: string,
  featureModuleId: string,
  durationMonths: 1 | 12,
  autoRenew: boolean
): Promise<AdminResult<{ subscriptionId: string; paymentId: string }>> {
  // 權限檢查
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return { success: false, message: '無權限執行此操作' }

  try {
    // 查詢功能模組
    const module = await mainPrisma.featureModule.findUnique({
      where: { id: featureModuleId },
    })
    if (!module) return { success: false, message: '功能模組不存在' }

    // 計算期間和金額
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + durationMonths)
    const amount = durationMonths === 1 ? module.monthlyPrice : module.yearlyPrice

    // 在同一個事務中建立訂閱和支付
    const result = await mainPrisma.$transaction(async (tx) => {
      // 檢查是否已有相同功能的訂閱
      const existing = await tx.featureSubscription.findUnique({
        where: {
          venueId_featureModuleId: { venueId, featureModuleId },
        },
      })

      if (existing && existing.status === 'ACTIVE') {
        throw new Error('該功能已訂閱且處於有效狀態')
      }

      // 建立 FeatureSubscription
      const subscription = await tx.featureSubscription.create({
        data: {
          venueId,
          featureModuleId,
          status: 'PENDING_PAYMENT',
          startsAt: startDate,
          expiresAt: endDate,
          autoRenew,
          gracePeriodDays: 7,
          nextRenewalAt: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7天前開始嘗試續約
        },
      })

      // 建立 PlatformPayment
      const payment = await tx.platformPayment.create({
        data: {
          venueId,
          amount,
          status: 'PENDING',
          provider: 'tappay', // Phase 2：使用 TapPay
          subscriptionIds: subscription.id,
        },
      })

      return { subscription, payment }
    })

    revalidatePath('/admin/settings/features')
    return {
      success: true,
      message: '訂閱建立成功，請完成支付',
      data: {
        subscriptionId: result.subscription.id,
        paymentId: result.payment.id,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '建立訂閱失敗'
    return { success: false, message }
  }
}

/**
 * 更新訂閱狀態（通常在支付成功後調用）
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
  activatedAt?: Date
): Promise<AdminResult> {
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return { success: false, message: '無權限執行此操作' }

  try {
    await mainPrisma.featureSubscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        activatedAt: status === 'ACTIVE' ? activatedAt || new Date() : null,
      },
    })

    revalidatePath('/admin/settings/features')
    return { success: true, message: '訂閱狀態已更新' }
  } catch (err) {
    return { success: false, message: '更新失敗' }
  }
}

/**
 * 手動續約訂閱
 */
export async function renewSubscription(
  subscriptionId: string,
  durationMonths: 1 | 12
): Promise<AdminResult<{ newSubscriptionId: string; paymentId: string }>> {
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return { success: false, message: '無權限執行此操作' }

  try {
    // 查詢現有訂閱
    const subscription = await mainPrisma.featureSubscription.findUnique({
      where: { id: subscriptionId },
      include: { featureModule: true },
    })

    if (!subscription) return { success: false, message: '訂閱不存在' }

    // 建立新的訂閱和支付
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + durationMonths)
    const amount = durationMonths === 1 ? subscription.featureModule.monthlyPrice : subscription.featureModule.yearlyPrice

    const result = await mainPrisma.$transaction(async (tx) => {
      // 標記舊訂閱為已過期
      await tx.featureSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'EXPIRED' },
      })

      // 建立新訂閱
      const newSubscription = await tx.featureSubscription.create({
        data: {
          venueId: subscription.venueId,
          featureModuleId: subscription.featureModuleId,
          status: 'PENDING_PAYMENT',
          startsAt: startDate,
          expiresAt: endDate,
          autoRenew: subscription.autoRenew,
          gracePeriodDays: 7,
          nextRenewalAt: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      })

      // 建立支付
      const payment = await tx.platformPayment.create({
        data: {
          venueId: subscription.venueId,
          amount,
          status: 'PENDING',
          provider: 'tappay',
          subscriptionIds: newSubscription.id,
        },
      })

      return { newSubscription, payment }
    })

    revalidatePath('/admin/settings/features')
    return {
      success: true,
      message: '續約建立成功，請完成支付',
      data: {
        newSubscriptionId: result.newSubscription.id,
        paymentId: result.payment.id,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '續約失敗'
    return { success: false, message }
  }
}

/**
 * 取消訂閱
 */
export async function cancelSubscription(subscriptionId: string): Promise<AdminResult> {
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return { success: false, message: '無權限執行此操作' }

  try {
    await mainPrisma.featureSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        autoRenew: false,
      },
    })

    revalidatePath('/admin/settings/features')
    return { success: true, message: '訂閱已取消' }
  } catch (err) {
    return { success: false, message: '取消失敗' }
  }
}

/**
 * 應用寬限期（支付失敗時延長使用期限）
 */
export async function applyGracePeriod(subscriptionId: string, daysExtension?: number): Promise<AdminResult<{ newExpiryDate: Date }>> {
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return { success: false, message: '無權限執行此操作' }

  try {
    const subscription = await mainPrisma.featureSubscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!subscription) return { success: false, message: '訂閱不存在' }

    const extensionDays = daysExtension || subscription.gracePeriodDays || 7
    const newExpiryDate = new Date(subscription.expiresAt)
    newExpiryDate.setDate(newExpiryDate.getDate() + extensionDays)

    await mainPrisma.featureSubscription.update({
      where: { id: subscriptionId },
      data: {
        expiresAt: newExpiryDate,
        notes: `${subscription.notes || ''}|寬限期延長 ${extensionDays} 天至 ${newExpiryDate.toLocaleDateString('zh-TW')}`,
      },
    })

    revalidatePath('/admin/settings/features')
    return {
      success: true,
      message: `寬限期已應用，新到期日期：${newExpiryDate.toLocaleDateString('zh-TW')}`,
      data: { newExpiryDate },
    }
  } catch (err) {
    return { success: false, message: '應用寬限期失敗' }
  }
}

/**
 * 觸發自動續約（由後台任務調用）
 */
export async function triggerAutoRenewal(subscriptionId: string): Promise<AdminResult<{ paymentId: string }>> {
  try {
    const subscription = await mainPrisma.featureSubscription.findUnique({
      where: { id: subscriptionId },
      include: { featureModule: true },
    })

    if (!subscription || !subscription.autoRenew) {
      return { success: false, message: '訂閱不存在或未啟用自動續約' }
    }

    // 建立新的支付記錄
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 12) // 自動續約通常為 12 個月

    const result = await mainPrisma.$transaction(async (tx) => {
      // 建立新訂閱
      const newSubscription = await tx.featureSubscription.create({
        data: {
          venueId: subscription.venueId,
          featureModuleId: subscription.featureModuleId,
          status: 'PENDING_PAYMENT',
          startsAt: startDate,
          expiresAt: endDate,
          autoRenew: true,
          gracePeriodDays: 7,
          nextRenewalAt: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      })

      // 建立支付
      const payment = await tx.platformPayment.create({
        data: {
          venueId: subscription.venueId,
          amount: subscription.featureModule.yearlyPrice,
          status: 'PENDING',
          provider: 'tappay',
          subscriptionIds: newSubscription.id,
        },
      })

      // 更新原訂閱的續約信息
      await tx.featureSubscription.update({
        where: { id: subscriptionId },
        data: {
          nextRenewalAt: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          renewalAttempts: { increment: 1 },
        },
      })

      return payment
    })

    return {
      success: true,
      message: '自動續約已觸發',
      data: { paymentId: result.id },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '觸發自動續約失敗'
    return { success: false, message }
  }
}

/**
 * 處理過期訂閱（由後台任務調用）
 */
export async function handleExpiredSubscription(subscriptionId: string): Promise<AdminResult> {
  try {
    const subscription = await mainPrisma.featureSubscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!subscription) return { success: false, message: '訂閱不存在' }

    // 標記為已過期
    await mainPrisma.featureSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'EXPIRED',
        autoRenew: false,
        notes: `${subscription.notes || ''}|於 ${new Date().toLocaleDateString('zh-TW')} 自動過期`,
      },
    })

    return { success: true, message: '過期訂閱已處理' }
  } catch (err) {
    return { success: false, message: '處理過期訂閱失敗' }
  }
}

/**
 * 處理支付 Webhook 回調
 * 由 API 路由調用
 */
export async function processPaymentCallback(
  paymentId: string,
  status: 'COMPLETED' | 'FAILED',
  providerRef?: string
): Promise<AdminResult> {
  try {
    const result = await mainPrisma.$transaction(async (tx) => {
      // 更新支付狀態
      const payment = await tx.platformPayment.update({
        where: { id: paymentId },
        data: {
          status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          providerRef: providerRef || undefined,
          paidAt: status === 'COMPLETED' ? new Date() : null,
        },
        include: { subscriptions: true },
      })

      // 更新相關訂閱狀態
      if (status === 'COMPLETED') {
        // 支付成功：啟用所有相關訂閱
        const subscriptionIds = payment.subscriptionIds.split(',').filter(Boolean)
        await Promise.all(
          subscriptionIds.map((subId) =>
            tx.featureSubscription.update({
              where: { id: subId },
              data: {
                status: 'ACTIVE',
                activatedAt: new Date(),
              },
            })
          )
        )
      } else {
        // 支付失敗：設置重試時間
        await tx.platformPayment.update({
          where: { id: paymentId },
          data: {
            retryCount: { increment: 1 },
            nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小時後重試
          },
        })

        // 如果訂閱有寬限期，自動應用
        const subscriptionIds = payment.subscriptionIds.split(',').filter(Boolean)
        await Promise.all(
          subscriptionIds.map(async (subId) => {
            const sub = await tx.featureSubscription.findUnique({ where: { id: subId } })
            if (sub && sub.gracePeriodDays) {
              const newExpiryDate = new Date(sub.expiresAt)
              newExpiryDate.setDate(newExpiryDate.getDate() + sub.gracePeriodDays)
              await tx.featureSubscription.update({
                where: { id: subId },
                data: { expiresAt: newExpiryDate },
              })
            }
          })
        )
      }

      return payment
    })

    return {
      success: true,
      message: status === 'COMPLETED' ? '支付已確認，訂閱已啟用' : '支付失敗，已排隊重試',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '處理支付回調失敗'
    return { success: false, message }
  }
}
