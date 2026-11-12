/**
 * 取消與退款通知服務
 *
 * 發送渠道：
 * 1. LINE 訊息通知
 * 2. Email 詳細確認
 */

import type { Booking, Refund } from '@prisma/client'
import type { RefundEligibilityResult } from '@/lib/refund-rule-engine'

/**
 * 格式化退款方式為友善文本
 */
function formatRefundMethod(method: string): string {
  const mapping: Record<string, string> = {
    ORIGINAL_CARD: '💳 退回原付款信用卡（3-5 個工作日，視銀行作業）',
    POINTS: '⭐ 退回點數帳戶（立即入帳）',
    VOUCHER: '🎟️ 恢復使用券',
    MANUAL: '👤 人工處理（待客服審核）',
  }
  return mapping[method] || '人工處理'
}

/**
 * 構建取消通知 LINE 訊息
 */
export function buildCancellationLineMessage(
  booking: Booking,
  refund: Refund,
  eligibility: RefundEligibilityResult
): string {
  return `
✓ 訂單已取消

訂單代號：${booking.code}
取消時間：${new Date().toLocaleString('zh-TW')}

原始金額：NT$${booking.total}
退款金額：NT$${eligibility.actualRefundAmount}

退款方式：
${formatRefundMethod(eligibility.refundMethod)}

查看詳情：
https://booking.example.com/booking/${booking.code}

如有問題，請聯繫客服
LINE：@pickle-heaven
`.trim()
}

/**
 * 構建取消通知 Email 內容
 */
export function buildCancellationEmailContent(
  booking: Booking,
  refund: Refund,
  eligibility: RefundEligibilityResult
): {
  subject: string
  html: string
  text: string
} {
  const refundMethodText = formatRefundMethod(eligibility.refundMethod)
  const processingDays = eligibility.estimatedProcessingDays

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .section { margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #667eea; }
    .amount { font-size: 24px; font-weight: bold; color: #667eea; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ 訂單已取消</h1>
      <p>退款申請已提交</p>
    </div>

    <div class="content">
      <div class="section">
        <h3>訂單資訊</h3>
        <p><strong>訂單代號：</strong>${booking.code}</p>
        <p><strong>取消時間：</strong>${new Date().toLocaleString('zh-TW')}</p>
        <p><strong>預約日期：</strong>${booking.playDate}</p>
      </div>

      <div class="section">
        <h3>退款詳情</h3>
        <table style="width: 100%;">
          <tr>
            <td><strong>原始金額</strong></td>
            <td style="text-align: right;">NT$${booking.total}</td>
          </tr>
          <tr style="border-top: 1px solid #eee;">
            <td><strong>退款金額</strong></td>
            <td style="text-align: right; color: #667eea;"><strong>NT$${eligibility.actualRefundAmount}</strong></td>
          </tr>
        </table>

        <p style="margin-top: 15px;">
          <strong>退款方式：</strong><br>
          ${refundMethodText}
        </p>

        <p style="margin-top: 15px; padding: 10px; background: #e8f4f8; border-radius: 4px;">
          <strong>預計入帳：</strong>
          ${processingDays === 1 ? '立即入帳' : `${processingDays}-${processingDays + 2} 個工作日'}
        </p>
      </div>

      <div class="section">
        <h3>後續步驟</h3>
        <ol>
          <li>退款申請已提交，現在處理中</li>
          <li>您可以在會員帳戶查看退款進度</li>
          <li>款項入帳後，會發送確認通知</li>
        </ol>
      </div>

      <div class="section">
        <h3>需要幫助？</h3>
        <p>如有任何疑問，歡迎聯繫我們：</p>
        <ul>
          <li>LINE：@pickle-heaven</li>
          <li>電話：02-XXXX-XXXX</li>
          <li>Email：service@pickle-heaven.com</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>此為自動發送的確認郵件，請勿直接回覆。</p>
      <p>&copy; 2026 匹克天堂。版權所有。</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
✓ 訂單已取消

訂單代號：${booking.code}
取消時間：${new Date().toLocaleString('zh-TW')}

原始金額：NT$${booking.total}
退款金額：NT$${eligibility.actualRefundAmount}

退款方式：${refundMethodText}

預計入帳：${processingDays === 1 ? '立即入帳' : `${processingDays}-${processingDays + 2} 個工作日`}

如有問題，請聯繫客服
LINE：@pickle-heaven
  `.trim()

  return {
    subject: `取消確認 — 訂單 ${booking.code}`,
    html,
    text,
  }
}

/**
 * 發送取消通知（LINE）
 *
 * TODO: 整合 LINE Messaging API
 */
export async function sendCancellationLineNotification(
  booking: Booking,
  refund: Refund,
  eligibility: RefundEligibilityResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = buildCancellationLineMessage(booking, refund, eligibility)

    // TODO: 調用 LINE SDK
    // await lineClient.pushMessage(booking.user.lineUserId, {
    //   type: 'text',
    //   text: message
    // })

    console.log('[線上測試] LINE 訊息已準備:', message)

    return { success: true }
  } catch (error) {
    console.error('[通知] LINE 發送失敗', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '發送失敗',
    }
  }
}

/**
 * 發送取消通知（Email）
 *
 * TODO: 整合郵件服務（SendGrid、AWS SES 等）
 */
export async function sendCancellationEmail(
  booking: Booking,
  refund: Refund,
  eligibility: RefundEligibilityResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = buildCancellationEmailContent(
      booking,
      refund,
      eligibility
    )

    if (!booking.user?.email) {
      return {
        success: false,
        error: '使用者未設置信箱',
      }
    }

    // TODO: 調用郵件服務 SDK
    // await emailService.send({
    //   to: booking.user.email,
    //   subject,
    //   html,
    //   text
    // })

    console.log('[線上測試] Email 已準備:', {
      to: booking.user?.email,
      subject,
      preview: text.slice(0, 100),
    })

    return { success: true }
  } catch (error) {
    console.error('[通知] Email 發送失敗', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '發送失敗',
    }
  }
}

/**
 * 組合發送所有通知
 */
export async function sendAllCancellationNotifications(
  booking: Booking & { user: any },
  refund: Refund,
  eligibility: RefundEligibilityResult
): Promise<{
  line: { success: boolean; error?: string }
  email: { success: boolean; error?: string }
}> {
  const [lineResult, emailResult] = await Promise.all([
    sendCancellationLineNotification(booking as any, refund, eligibility),
    sendCancellationEmail(booking as any, refund, eligibility),
  ])

  return {
    line: lineResult,
    email: emailResult,
  }
}
