import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/payments/initiate
 * 初始化支付流程（包含場地租借、活動、商品訂單）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const {
      bookingId,
      productOrderId,
      paymentMethod,
      amount,
    } = body

    // 驗證訂單
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { userId: true, status: true, total: true },
      })

      if (!booking || booking.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      if (booking.status !== 'PENDING') {
        return NextResponse.json({ error: '訂單狀態不允許支付' }, { status: 400 })
      }
    }

    if (productOrderId) {
      const order = await prisma.productOrder.findUnique({
        where: { id: productOrderId },
        select: { userId: true, status: true, total: true },
      })

      if (!order || order.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      if (order.status !== 'PENDING') {
        return NextResponse.json({ error: '訂單狀態不允許支付' }, { status: 400 })
      }
    }

    if (!bookingId && !productOrderId) {
      return NextResponse.json({ error: '缺少訂單資訊' }, { status: 400 })
    }

    // 生成交易編號
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 支付方法特定邏輯
    if (paymentMethod === 'LINE_PAY') {
      // LINE Pay 重定向 URI
      const linePayRedirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/line-pay?transactionId=${transactionId}`

      return NextResponse.json({
        transactionId,
        paymentMethod: 'LINE_PAY',
        amount,
        redirectUrl: linePayRedirectUri,
        // 實際使用時應呼叫 LINE Pay API
        // const linePayResult = await initiateLINEPay(amount, transactionId);
      })
    }

    if (paymentMethod === 'CREDIT_CARD') {
      // 信用卡支付方式
      return NextResponse.json({
        transactionId,
        paymentMethod: 'CREDIT_CARD',
        amount,
        // 返回信用卡表單所需資訊
        // 實際使用時應使用 Stripe、Newebpay 等第三方服務
      })
    }

    return NextResponse.json({ error: '不支援的支付方式' }, { status: 400 })
  } catch (error) {
    console.error('[API] POST /payments/initiate error:', error)
    return NextResponse.json({ error: '初始化支付失敗' }, { status: 500 })
  }
}
