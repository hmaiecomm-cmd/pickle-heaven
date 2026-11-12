/**
 * 郵件服務 — 發送告警和通知郵件
 *
 * 支持：
 * 1. Watchdog 告警通知
 * 2. 進程崩潰通知
 * 3. 連線問題通知
 * 4. 系統狀態報告
 */

import 'server-only'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * 發送郵件的通用函數
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    // 檢查必要的環境變數
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'
    const emailFrom = process.env.EMAIL_FROM

    if (!emailFrom) {
      console.warn('[Email] 未配置 EMAIL_FROM，郵件功能已禁用')
      return {
        success: false,
        error: 'EMAIL_FROM 未配置',
      }
    }

    // 根據不同的郵件提供商路由
    if (emailProvider === 'sendgrid') {
      return await sendViaSegridGrid({
        ...options,
        from: emailFrom,
      })
    } else if (emailProvider === 'resend') {
      return await sendViaResend({
        ...options,
        from: emailFrom,
      })
    } else {
      // 默認使用 SMTP
      return await sendViaSMTP({
        ...options,
        from: emailFrom,
      })
    }
  } catch (error) {
    console.error('[Email] 發送失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
    }
  }
}

/**
 * 通過 SendGrid 發送
 */
async function sendViaSegridGrid(options: EmailOptions & { from: string }): Promise<EmailResult> {
  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  try {
    const [response] = await sgMail.send({
      to: options.to,
      from: options.from,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    return {
      success: true,
      messageId: response.headers['x-message-id'],
    }
  } catch (error) {
    throw error
  }
}

/**
 * 通過 Resend 發送
 */
async function sendViaResend(options: EmailOptions & { from: string }): Promise<EmailResult> {
  const { Resend } = require('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const result = await resend.emails.send({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    return {
      success: true,
      messageId: result.data.id,
    }
  } catch (error) {
    throw error
  }
}

/**
 * 通過 SMTP 發送（使用 Nodemailer）
 */
async function sendViaSMTP(options: EmailOptions & { from: string }): Promise<EmailResult> {
  const nodemailer = require('nodemailer')

  try {
    // 創建傳輸器
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    // 發送郵件
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    throw error
  }
}

/**
 * 發送 Watchdog 告警郵件
 */
export async function sendWatchdogAlertEmail(alert: {
  type: string
  severity: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR'
  title: string
  description: string
  component: string
  timestamp: Date
}): Promise<EmailResult> {
  const severityEmoji = {
    HEALTHY: '✅',
    DEGRADED: '⚠️',
    OFFLINE: '🔴',
    ERROR: '❌',
  }

  const severityColor = {
    HEALTHY: '#10b981',
    DEGRADED: '#f59e0b',
    OFFLINE: '#ef4444',
    ERROR: '#dc2626',
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${severityColor[alert.severity]}; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${severityEmoji[alert.severity]} ${alert.title}</h2>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">嚴重程度</p>
          <p style="margin: 0; font-weight: bold; font-size: 16px;">${alert.severity}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">元件</p>
          <p style="margin: 0; font-family: monospace; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${alert.component}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">詳情</p>
          <p style="margin: 0; line-height: 1.6; color: #374151;">${alert.description}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">時間</p>
          <p style="margin: 0; font-family: monospace; color: #374151;">${alert.timestamp.toISOString()}</p>
        </div>

        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 20px;">
          <p style="margin: 0; color: #15803d; font-size: 14px;">
            💡 <strong>提示：</strong> 系統已自動記錄此告警。請查看監控儀表板了解更多信息。
          </p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">這是自動生成的告警郵件。請勿直接回复。</p>
        <p style="margin: 5px 0 0 0;">© 顧好 AI 智慧場館平台</p>
      </div>
    </div>
  `

  const text = `
${alert.title}

嚴重程度：${alert.severity}
元件：${alert.component}

詳情：
${alert.description}

時間：${alert.timestamp.toISOString()}

系統已自動記錄此告警。請查看監控儀表板了解更多信息。
  `.trim()

  return sendEmail({
    to: process.env.ALERT_EMAIL_TO || process.env.EMAIL_FROM || '',
    subject: `[${alert.severity}] ${alert.title}`,
    html,
    text,
  })
}

/**
 * 發送進程崩潰郵件
 */
export async function sendProcessCrashEmail(details: {
  processName: string
  crashTime: Date
  crashCount: number
  lastRestartTime?: Date
  message?: string
}): Promise<EmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">❌ 進程崩潰告警</h2>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">進程名稱</p>
          <p style="margin: 0; font-family: monospace; font-weight: bold;">${details.processName}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">崩潰時間</p>
          <p style="margin: 0; font-family: monospace;">${details.crashTime.toISOString()}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">崩潰次數</p>
          <p style="margin: 0; font-weight: bold; font-size: 18px; color: #dc2626;">${details.crashCount}</p>
        </div>

        ${details.lastRestartTime ? `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">最後重啟時間</p>
            <p style="margin: 0; font-family: monospace;">${details.lastRestartTime.toISOString()}</p>
          </div>
        ` : ''}

        ${details.message ? `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">詳情</p>
            <p style="margin: 0; background-color: #fef2f2; padding: 10px; border-radius: 4px; color: #991b1b;">${details.message}</p>
          </div>
        ` : ''}

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-top: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            ⚠️ <strong>需要注意：</strong> 進程已自動重啟。如果持續崩潰，請檢查系統日誌。
          </p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">這是自動生成的告警郵件。請勿直接回复。</p>
      </div>
    </div>
  `

  const text = `
進程崩潰告警

進程名稱：${details.processName}
崩潰時間：${details.crashTime.toISOString()}
崩潰次數：${details.crashCount}
${details.lastRestartTime ? `最後重啟時間：${details.lastRestartTime.toISOString()}` : ''}
${details.message ? `詳情：${details.message}` : ''}

進程已自動重啟。如果持續崩潰，請檢查系統日誌。
  `.trim()

  return sendEmail({
    to: process.env.ALERT_EMAIL_TO || process.env.EMAIL_FROM || '',
    subject: `❌ 進程崩潰告警: ${details.processName}`,
    html,
    text,
  })
}

/**
 * 發送連線問題郵件
 */
export async function sendConnectionAlertEmail(details: {
  deviceId: string
  status: 'DISCONNECTED' | 'RECONNECTING' | 'ERROR'
  message: string
  lastHeartbeat?: Date
  reconnectAttempts?: number
}): Promise<EmailResult> {
  const statusEmoji = {
    DISCONNECTED: '🔴',
    RECONNECTING: '🟡',
    ERROR: '❌',
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f59e0b; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${statusEmoji[details.status]} 連線問題告警</h2>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">設備 ID</p>
          <p style="margin: 0; font-family: monospace; font-weight: bold;">${details.deviceId}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">狀態</p>
          <p style="margin: 0; font-weight: bold;">${details.status}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">詳情</p>
          <p style="margin: 0; background-color: #fef3c7; padding: 10px; border-radius: 4px; color: #78350f;">${details.message}</p>
        </div>

        ${details.lastHeartbeat ? `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">最後心跳</p>
            <p style="margin: 0; font-family: monospace;">${details.lastHeartbeat.toISOString()}</p>
          </div>
        ` : ''}

        ${typeof details.reconnectAttempts === 'number' ? `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px;">重連嘗試</p>
            <p style="margin: 0; font-weight: bold;">${details.reconnectAttempts} 次</p>
          </div>
        ` : ''}

        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 20px;">
          <p style="margin: 0; color: #15803d; font-size: 14px;">
            💡 <strong>系統正在自動重連。</strong> 如果問題持續，請檢查網路連接。
          </p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">這是自動生成的告警郵件。</p>
      </div>
    </div>
  `

  const text = `
連線問題告警

設備 ID：${details.deviceId}
狀態：${details.status}
詳情：${details.message}
${details.lastHeartbeat ? `最後心跳：${details.lastHeartbeat.toISOString()}` : ''}
${typeof details.reconnectAttempts === 'number' ? `重連嘗試：${details.reconnectAttempts} 次` : ''}

系統正在自動重連。
  `.trim()

  return sendEmail({
    to: process.env.ALERT_EMAIL_TO || process.env.EMAIL_FROM || '',
    subject: `⚠️ 連線問題: ${details.deviceId} - ${details.status}`,
    html,
    text,
  })
}
