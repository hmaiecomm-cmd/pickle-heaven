/**
 * TapPay Webhook 處理器
 * 接收支付結果回調並更新訂閱狀態
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { mainPrisma } from '@/lib/db'
import { processPaymentCallback } from '@/app/admin/settings/features/actions'

/**
 * TapPay Webhook 簽章驗證
 * 使用 HMAC-SHA256 驗證
 */
function verifyTapPaySignature(payload: string, signature: string, secret: string): boolean {
  const hash = createHmac('sha256', secret).update(payload).digest('hex')
  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    // 讀取原始請求體（用於簽章驗證）
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody)

    // 提取簽章頭
    const signature = request.headers.get('x-tappay-signature') || ''

    // 注意：在實際應用中應從環境變數或資料庫讀取 secret
    const webhookSecret = process.env.PLATFORM_TAPPAY_WEBHOOK_SECRET || ''

    // 驗證簽章
    const isValid = verifyTapPaySignature(rawBody, signature, webhookSecret)

    // 如果簽章無效，仍然返回 200（防止重複）但不處理
    if (!isValid) {
      console.warn('[TapPay Webhook] 無效的簽章', { merchant_ref: payload.merchant_ref })
      return NextResponse.json({ status: 'invalid_signature' }, { status: 200 })
    }

    // 處理支付結果
    const { status, merchant_ref: paymentRef, amount } = payload

    // 查詢支付記錄（使用 findFirst 因為 providerRef 不是 unique）
    const payment = await mainPrisma.platformPayment.findFirst({
      where: { providerRef: paymentRef },
    })

    // 記錄 Webhook 到資料庫
    if (payment) {
      await mainPrisma.platformWebhookLog.create({
        data: {
          paymentId: payment.id,
          venueId: payment.venueId,
          provider: 'tappay',
          signatureValid: isValid,
          signature: signature.substring(0, 32) + '...', // 只記錄簽章前 32 個字符
          rawPayload: {
            status: payload.status,
            amount: payload.amount,
            merchant_ref: paymentRef,
            // 移除敏感信息
            card_last_four: payload.card_last_four || null,
          },
          processed: false,
        },
      })
    }

    if (!payment) {
      console.warn('[TapPay Webhook] 支付記錄不存在', { paymentRef })
      return NextResponse.json({ status: 'payment_not_found' }, { status: 400 })
    }

    // 驗證金額匹配
    if (amount !== payment.amount) {
      console.warn('[TapPay Webhook] 金額不匹配', { expected: payment.amount, received: amount })
      return NextResponse.json({ status: 'amount_mismatch' }, { status: 400 })
    }

    // 根據狀態處理
    // TapPay 狀態碼：0 = 成功, 1-999 = 各種失敗
    const paymentStatus = status === 0 ? 'COMPLETED' : 'FAILED'

    // 調用 Server Action 更新訂閱
    const result = await processPaymentCallback(payment.id, paymentStatus, paymentRef)

    // 更新 Webhook 日誌為已處理
    await mainPrisma.platformWebhookLog.updateMany({
      where: {
        paymentId: payment.id,
        processed: false,
      },
      data: {
        processed: true,
        processedAt: new Date(),
        error: result.success ? null : result.message,
      },
    })

    console.log('[TapPay Webhook] 處理成功', { paymentRef, status: paymentStatus })

    // 返回 TapPay 要求的 ACK 格式
    return NextResponse.json(
      { status: 'success', message: 'Webhook processed' },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤'
    console.error('[TapPay Webhook] 處理失敗', { error: message })

    // 即使出錯也返回 200，防止 TapPay 重複發送
    return NextResponse.json(
      { status: 'error', message },
      { status: 200 } // 注意：返回 200 以停止 TapPay 重試
    )
  }
}

// 測試 Endpoint：模擬 TapPay Webhook（僅開發用）
export async function PUT(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { paymentRef, status } = body

    // 建立模擬簽章
    const webhookSecret = process.env.PLATFORM_TAPPAY_WEBHOOK_SECRET || 'test-secret'
    const mockPayload = JSON.stringify({
      status: status === 'success' ? 0 : 1,
      merchant_ref: paymentRef,
      amount: 999900,
    })
    const mockSignature = createHmac('sha256', webhookSecret).update(mockPayload).digest('hex')

    // 發送給自己的 webhook endpoint
    const webhookUrl = `${process.env.PLATFORM_WEBHOOK_BASE_URL || 'http://localhost:3000/api/admin/platform-payments/webhook'}/tappay`
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tappay-signature': mockSignature,
      },
      body: mockPayload,
    })

    return NextResponse.json(
      { success: true, message: 'Mock webhook sent', response: await response.json() },
      { status: 200 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '測試失敗' },
      { status: 400 }
    )
  }
}
