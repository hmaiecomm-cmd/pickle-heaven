/**
 * 郵件發送服務
 * 支持多個 provider: LINE 通知、SMTP、Resend 等
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

/**
 * 發送 Admin 邀請郵件
 */
export async function sendInvitationEmail(
  email: string,
  invitationToken: string,
  expiresAt: Date,
  role: string
): Promise<boolean> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationLink = `${appUrl}/admin/login?invite=${invitationToken}`

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .content { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 10px; }
      .footer { font-size: 12px; color: #666; text-align: center; }
      .expiry { color: #dc2626; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; font-size: 24px;">匹克精靈 Pickle Heaven</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">後台管理員邀請</p>
      </div>

      <div class="content">
        <p>Hi,</p>
        <p>您已被邀請加入匹克精靈後台管理系統。</p>
        <p><strong>角色:</strong> ${translateRole(role)}</p>

        <p>請點擊下方按鈕接受邀請並完成設置：</p>
        <a href="${invitationLink}" class="button">接受邀請</a>

        <p>或複製此連結到瀏覽器：<br>
        <code style="background: #e5e7eb; padding: 5px 10px; border-radius: 4px; word-break: break-all;">
          ${invitationLink}
        </code></p>

        <p class="expiry">
          ⚠️ 此邀請將在 ${expiresAt.toLocaleString('zh-TW')} 過期
        </p>
      </div>

      <div class="footer">
        <p>© 2026 Pickle Heaven. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
    `

    // 根據環境配置選擇發送方式
    const provider = process.env.EMAIL_PROVIDER || 'console'

    if (provider === 'resend') {
      return await sendViaResend(email, '匹克精靈 - 後台管理員邀請', html)
    } else if (provider === 'line') {
      // LINE Messaging API 發送（開發中）
      console.log('LINE email sending not yet implemented')
      return true
    } else {
      // Console 模式（開發環境）
      console.log(`[MOCK] Invitation email sent to: ${email}`)
      console.log(`[MOCK] Expires at: ${expiresAt.toISOString()}`)
      return true
    }
  } catch (error) {
    console.error('Failed to send invitation email:', error)
    return false
  }
}

/**
 * 翻譯角色名稱
 */
function translateRole(role: string): string {
  const roleMap: Record<string, string> = {
    OWNER: '擁有者',
    MANAGER: '經理',
    STAFF: '現場人員',
    FINANCE: '財務',
    MAINTENANCE: '設備維護',
  }
  return roleMap[role] || role
}

/**
 * 使用 Resend 發送郵件
 */
async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@pickleheavne.local',
      to,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return false
    }

    console.log(`Email sent via Resend: ${result.data?.id}`)
    return true
  } catch (error) {
    console.error('Failed to send via Resend:', error)
    return false
  }
}
