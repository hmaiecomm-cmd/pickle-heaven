import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Cron Job: 每日檢查並處理待續約的訂閱
 *
 * 流程：
 * 1. 查詢所有 nextRenewalAt <= 今天 的 ACTIVE 訂閱
 * 2. 對每個訂閱檢查是否有有效的支付方式
 * 3. 建立新的 PlatformPayment 記錄（狀態：PENDING）
 * 4. 更新 FeatureSubscription 狀態為 PENDING_PAYMENT
 * 5. 如果缺少支付方式，進入 7 天寬限期
 */

export async function POST(request: NextRequest) {
  // 驗證 Vercel Cron 請求
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // 1. 查詢待續約的訂閱
    const subscriptions = await prisma.featureSubscription.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        nextRenewalAt: {
          lte: now,
        },
      },
      include: {
        venue: true,
        featureModule: true,
      },
    })

    console.log(`[Subscription Renewal] 發現 ${subscriptions.length} 個待續約訂閱`)

    let successCount = 0
    let failureCount = 0

    for (const subscription of subscriptions) {
      try {
        // 2. 檢查支付方式
        const paymentMethod = await prisma.venuePaymentMethod.findFirst({
          where: {
            venueId: subscription.venueId,
            isActive: true,
            isDefault: true,
          },
        })

        if (!paymentMethod) {
          // 進入 7 天寬限期
          await prisma.featureSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'GRACE_PERIOD',
              renewalFailReason: '缺少有效的支付方式',
              renewalAttempts: subscription.renewalAttempts + 1,
            },
          })

          failureCount++
          console.log(`[Renewal] 訂閱 ${subscription.id} 進入寬限期：缺少支付方式`)
          continue
        }

        // 3. 建立續約支付記錄
        const amount = subscription.featureModule.yearlyPrice

        const payment = await prisma.platformPayment.create({
          data: {
            venueId: subscription.venueId,
            amount,
            status: 'PENDING',
            provider: paymentMethod.provider,
            subscriptionIds: subscription.id,
          },
        })

        // 4. 更新訂閱狀態
        const newExpiresAt = new Date(subscription.expiresAt)
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1)

        await prisma.featureSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PENDING_PAYMENT',
            platformPaymentId: payment.id,
            nextRenewalAt: null,
            renewalAttempts: subscription.renewalAttempts + 1,
            expiresAt: newExpiresAt,
          },
        })

        successCount++
        console.log(`[Renewal] 訂閱 ${subscription.id} 已建立續約支付 ${payment.id}`)
      } catch (err) {
        failureCount++
        console.error(`[Renewal] 訂閱 ${subscription.id} 處理失敗：`, err)
      }
    }

    // 5. 嘗試重試失敗的續約
    const failedSubscriptions = await prisma.featureSubscription.findMany({
      where: {
        status: { in: ['GRACE_PERIOD', 'RENEWAL_FAILED'] },
        renewalAttempts: {
          lt: 3,
        },
        nextRetryAt: {
          lte: now,
        },
      },
      include: {
        venue: true,
        featureModule: true,
      },
    })

    console.log(`[Subscription Renewal] 發現 ${failedSubscriptions.length} 個待重試的訂閱`)

    for (const subscription of failedSubscriptions) {
      try {
        const paymentMethod = await prisma.venuePaymentMethod.findFirst({
          where: {
            venueId: subscription.venueId,
            isActive: true,
            isDefault: true,
          },
        })

        if (!paymentMethod) {
          // 仍然沒有支付方式，推遲重試
          const nextRetry = new Date(now)
          nextRetry.setDate(nextRetry.getDate() + 1)

          await prisma.featureSubscription.update({
            where: { id: subscription.id },
            data: {
              nextRetryAt: nextRetry,
            },
          })
          continue
        }

        // 重新嘗試建立支付
        const amount = subscription.featureModule.yearlyPrice

        const payment = await prisma.platformPayment.create({
          data: {
            venueId: subscription.venueId,
            amount,
            status: 'PENDING',
            provider: paymentMethod.provider,
            subscriptionIds: subscription.id,
          },
        })

        const newExpiresAt = new Date(subscription.expiresAt)
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1)

        await prisma.featureSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PENDING_PAYMENT',
            platformPaymentId: payment.id,
            nextRetryAt: null,
            renewalAttempts: subscription.renewalAttempts + 1,
            expiresAt: newExpiresAt,
          },
        })

        successCount++
        console.log(`[Renewal Retry] 訂閱 ${subscription.id} 重試成功，建立支付 ${payment.id}`)
      } catch (err) {
        console.error(`[Renewal Retry] 訂閱 ${subscription.id} 重試失敗：`, err)
      }
    }

    return NextResponse.json({
      success: true,
      processed: subscriptions.length,
      successCount,
      failureCount,
      retryAttempts: failedSubscriptions.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Subscription Renewal] 處理失敗：', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // 允許 Vercel Cron 透過 GET 請求觸發
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return POST(request)
}
