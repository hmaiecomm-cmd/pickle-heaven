import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/orders/send-confirmation
 * 發送訂單確認郵件和 LINE 通知
 * 支援場地租借訂單和商品訂單
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const { bookingId, productOrderId, notificationType = 'all' } = body

    if (!bookingId && !productOrderId) {
      return NextResponse.json({ error: '缺少訂單資訊' }, { status: 400 })
    }

    const notifications: any[] = []

    // 發送場地租借訂單確認
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          items: { include: { court: true } },
          venue: true,
        },
      })

      if (!booking || booking.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      // 發送郵件
      if (notificationType === 'email' || notificationType === 'all') {
        const emailContent = generateBookingConfirmationEmail(booking)
        // TODO: 整合郵件服務（SendGrid、AWS SES 等）
        notifications.push({
          type: 'EMAIL',
          status: 'PENDING',
          recipient: booking.user.email,
          subject: `場地租借確認 - 訂單編號：${booking.code}`,
          message: emailContent,
        })
      }

      // 發送 LINE 通知
      if (notificationType === 'line' || notificationType === 'all') {
        if (booking.user.lineUserId) {
          const lineMessage = generateBookingConfirmationLine(booking)
          // TODO: 整合 LINE Notify
          notifications.push({
            type: 'LINE',
            status: 'PENDING',
            userId: booking.user.id,
            message: lineMessage,
          })
        }
      }
    }

    // 發送商品訂單確認
    if (productOrderId) {
      const order = await prisma.productOrder.findUnique({
        where: { id: productOrderId },
        include: {
          user: true,
          items: { include: { product: true } },
          venue: true,
        },
      })

      if (!order || order.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      // 發送郵件
      if (notificationType === 'email' || notificationType === 'all') {
        const emailContent = generateProductOrderConfirmationEmail(order)
        // TODO: 整合郵件服務
        notifications.push({
          type: 'EMAIL',
          status: 'PENDING',
          recipient: order.user.email,
          subject: `商品訂單確認 - 訂單編號：${order.code}`,
          message: emailContent,
        })
      }

      // 發送 LINE 通知
      if (notificationType === 'line' || notificationType === 'all') {
        if (order.user.lineUserId) {
          const lineMessage = generateProductOrderConfirmationLine(order)
          // TODO: 整合 LINE Notify
          notifications.push({
            type: 'LINE',
            status: 'PENDING',
            userId: order.user.id,
            message: lineMessage,
          })
        }
      }
    }

    // 返回成功響應
    return NextResponse.json({
      success: true,
      notifications,
      message: `已發送 ${notifications.length} 則通知`,
    })
  } catch (error) {
    console.error('[API] POST /orders/send-confirmation error:', error)
    return NextResponse.json({ error: '發送確認通知失敗' }, { status: 500 })
  }
}

// 輔助函式：生成場地租借確認郵件內容
function generateBookingConfirmationEmail(booking: any): string {
  const itemsHtml = booking.items
    .map(
      (item: any) =>
        `<tr>
        <td>${item.court.name}</td>
        <td>${item.startsAt} - ${item.endsAt}</td>
        <td>NT$${item.price}</td>
      </tr>`
    )
    .join('')

  return `
    <h2>場地租借確認</h2>
    <p>親愛的 ${booking.user.displayName}，</p>
    <p>感謝您的預訂！以下是您的訂單詳情：</p>

    <h3>訂單編號：${booking.code}</h3>
    <h3>預訂日期：${booking.playDate}</h3>

    <table border="1">
      <thead>
        <tr>
          <th>場地</th>
          <th>時間</th>
          <th>價格</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <h3>訂單總額：NT$${booking.total}</h3>
    <p>請於指定時間前到達場館。如有任何問題，請聯絡客服。</p>
  `
}

// 輔助函式：生成場地租借 LINE 通知
function generateBookingConfirmationLine(booking: any): string {
  const courts = booking.items.map((item: any) => item.court.name).join('、')
  return `✅ 場地租借已確認！\n訂單編號：${booking.code}\n場地：${courts}\n日期：${booking.playDate}\n總金額：NT$${booking.total}`
}

// 輔助函式：生成商品訂單確認郵件內容
function generateProductOrderConfirmationEmail(order: any): string {
  const itemsHtml = order.items
    .map(
      (item: any) => `
      <tr>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>NT$${item.unitPrice}</td>
        <td>NT$${item.subtotal}</td>
      </tr>`
    )
    .join('')

  return `
    <h2>商品訂單確認</h2>
    <p>親愛的 ${order.user.displayName}，</p>
    <p>感謝您的購買！以下是您的訂單詳情：</p>

    <h3>訂單編號：${order.code}</h3>

    <table border="1">
      <thead>
        <tr>
          <th>商品</th>
          <th>數量</th>
          <th>單價</th>
          <th>小計</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <h3>訂單總額：NT$${order.total}</h3>
    <h3>收件資訊</h3>
    <p>收件人：${order.recipientName}<br/>電話：${order.recipientPhone}<br/>地址：${order.recipientAddress}</p>
    <p>我們將盡快處理您的訂單並寄出。感謝您的購買！</p>
  `
}

// 輔助函式：生成商品訂單 LINE 通知
function generateProductOrderConfirmationLine(order: any): string {
  const products = order.items.map((item: any) => `${item.productName}×${item.quantity}`).join('、')
  return `✅ 商品訂單已確認！\n訂單編號：${order.code}\n商品：${products}\n總金額：NT$${order.total}\n收件人：${order.recipientName}`
}
