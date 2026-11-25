/**
 * 功能訂閱後台任務
 * 1. 檢查即將過期的訂閱，觸發自動續約
 * 2. 檢查已過期的訂閱，標記為已過期
 * 3. 檢查支付失敗，觸發重試
 *
 * 在 Vercel 中設置 cron 觸發器：
 * vercel.json: { "crons": [{ "path": "/api/cron/platform-subscriptions", "schedule": "0 2 * * *" }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { mainPrisma } from '@/lib/db'
import { triggerAutoRenewal, handleExpiredSubscription } from '@/app/admin/settings/features/actions'

// Vercel 要求的驗證令牌
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret'

export async function GET(request: NextRequest) {
  // 驗證請求來自 Vercel
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const now = new Date()
    const stats = {
      autoRenewTriggered: 0,
      autoRenewFailed: 0,
      expiredProcessed: 0,
      retryInitiated: 0,
      error: null as string | null,
    }

    // 1. 觸發自動續約
    // 查找：autoRenew=true, status=ACTIVE, nextRenewalAt <= 現在
    const autoRenewSubscriptions = await mainPrisma.featureSubscription.findMany({
      where: {
        autoRenew: true,
        status: 'ACTIVE',
        nextRenewalAt: {
          lte: now,
        },
      },
      select: { id: true, venueId: true },
      take: 100, // 限制一次處理 100 個
    })

    for (const sub of autoRenewSubscriptions) {
      try {
        const result = await triggerAutoRenewal(sub.id)
        if (result.success) {
          stats.autoRenewTriggered++
        } else {
          stats.autoRenewFailed++
        }
      } catch (err) {
        console.error(`[Auto-Renew] 訂閱 ${sub.id} 失敗:`, err)
        stats.autoRenewFailed++
      }
    }

    // 2. 處理已過期訂閱
    // 查找：status=ACTIVE, expiresAt < 現在 - 寬限期
    const expiredSubscriptions = await mainPrisma.featureSubscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: now,
        },
      },
      select: { id: true, venueId: true },
      take: 100,
    })

    for (const sub of expiredSubscriptions) {
      try {
        const result = await handleExpiredSubscription(sub.id)
        if (result.success) {
          stats.expiredProcessed++
        }
      } catch (err) {
        console.error(`[Expiration] 訂閱 ${sub.id} 失敗:`, err)
      }
    }

    // 3. 重試失敗的支付
    // 查找：status=FAILED, nextRetryAt <= 現在, retryCount < 3
    const failedPayments = await mainPrisma.platformPayment.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },
        nextRetryAt: {
          lte: now,
        },
      },
      select: { id: true, venueId: true, amount: true, provider: true },
      take: 50,
    })

    for (const payment of failedPayments) {
      try {
        // 更新支付狀態為待重試（實際支付邏輯在 Phase 2.5 實現）
        await mainPrisma.platformPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PENDING',
            lastRetryAt: now,
            nextRetryAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24小時後再試
          },
        })
        stats.retryInitiated++
      } catch (err) {
        console.error(`[Retry] 支付 ${payment.id} 失敗:`, err)
      }
    }

    // 4. 清理舊的 Webhook 日誌（保留 90 天）
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    try {
      const deleted = await mainPrisma.platformWebhookLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      })
      console.log(`[Cleanup] 已刪除 ${deleted.count} 條舊 Webhook 日誌`)
    } catch (err) {
      console.error('[Cleanup] 清理 Webhook 日誌失敗:', err)
    }

    console.log('[Cron] 功能訂閱後台任務完成:', stats)

    return NextResponse.json(
      {
        success: true,
        message: '後台任務執行完成',
        stats,
        timestamp: now.toISOString(),
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤'
    console.error('[Cron] 後台任務失敗:', message)

    return NextResponse.json(
      {
        success: false,
        message: '後台任務執行失敗',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 測試 Endpoint（開發用）
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // 開發環境下直接調用 GET
  return GET(request)
}
