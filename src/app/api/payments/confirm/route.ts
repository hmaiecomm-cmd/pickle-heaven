import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/payments/confirm
 * 確認支付完成，更新訂單狀態
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const {
      transactionId,
      bookingId,
      productOrderId,
      paymentMethod,
      amount,
    } = body

    // 驗證參數
    if (!transactionId || (!bookingId && !productOrderId)) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    let updatedBooking = null
    let updatedOrder = null

    // 更新場地租借訂單
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { userId: true, status: true, total: true },
      })

      if (!booking || booking.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        include: { items: true, user: true },
      })

      // 建立付款記錄
      await prisma.payment.create({
        data: {
          bookingId,
          provider: 'mock',
          method: paymentMethod as any,
          amount,
          status: 'SUCCESS',
          providerRef: transactionId,
          paidAt: new Date(),
        },
      })
    }

    // 更新商品訂單
    if (productOrderId) {
      const order = await prisma.productOrder.findUnique({
        where: { id: productOrderId },
        select: { userId: true, status: true, total: true },
      })

      if (!order || order.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      updatedOrder = await prisma.productOrder.update({
        where: { id: productOrderId },
        data: {
          status: 'PAID',
          paymentStatus: 'SUCCESS',
          paidAt: new Date(),
        },
        include: {
          items: { include: { product: true } },
          user: true,
        },
      })

      // 建立付款記錄
      await prisma.productPayment.create({
        data: {
          orderId: productOrderId,
          method: paymentMethod as any,
          amount,
          status: 'SUCCESS',
          transactionId,
          paidAt: new Date(),
        },
      })
    }

    // 返回成功響應
    return NextResponse.json({
      success: true,
      transactionId,
      booking: updatedBooking,
      order: updatedOrder,
      message: '支付成功，訂單已更新',
    })
  } catch (error) {
    console.error('[API] POST /payments/confirm error:', error)
    return NextResponse.json({ error: '確認支付失敗' }, { status: 500 })
  }
}

/**
 * GET /api/payments/status/:transactionId
 * 查詢支付狀態
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')

    if (!transactionId) {
      return NextResponse.json({ error: '缺少交易編號' }, { status: 400 })
    }

    // 查詢付款記錄
    // 注意：此處應該根據 transactionId 在 Payment/ProductPayment 表中查詢
    // 以下為示例，實際需要實作完整邏輯

    return NextResponse.json({
      transactionId,
      status: 'PENDING', // 實際應查詢資料庫
      message: '交易狀態查詢',
    })
  } catch (error) {
    console.error('[API] GET /payments/status error:', error)
    return NextResponse.json({ error: '查詢支付狀態失敗' }, { status: 500 })
  }
}
