import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getPaymentProvider } from '@/lib/payments'

/**
 * POST /api/payments/confirm
 *
 * 確認支付完成（LINE Pay 二次確認或其他方式）
 *
 * 查詢參數：
 * - bookingId: 訂單 ID
 * - transactionId: 金流商交易編號（LINE Pay 專用）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('bookingId')
    const transactionId = searchParams.get('transactionId')

    if (!bookingId) {
      return NextResponse.json({ error: '缺少訂單 ID' }, { status: 400 })
    }

    // ===== 訂單驗證 =====
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, status: true, total: true },
    })

    if (!booking || booking.userId !== user.id) {
      return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
    }

    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        {
          ok: false,
          reason: '訂單非待支付狀態',
          status: booking.status,
        },
        { status: 400 }
      )
    }

    // ===== LINE Pay 二次確認 =====
    if (transactionId) {
      const provider = getPaymentProvider('linepay')

      if (!provider.confirm) {
        return NextResponse.json(
          { ok: false, reason: '該金流商不支持二次確認' },
          { status: 400 }
        )
      }

      const result = await provider.confirm({
        transactionId,
        amount: String(booking.total),
      })

      if (!result.ok) {
        // 記錄失敗但不阻斷輪詢（server-to-server 可能稍後成功）
        console.error('[confirm] LINE Pay 確認失敗', {
          bookingId,
          transactionId,
          reason: result.failReason,
        })

        return NextResponse.json({
          ok: false,
          reason: result.failReason,
        })
      }

      // ===== 成功：記錄交易並更新訂單 =====
      await prisma.payment.create({
        data: {
          bookingId,
          provider: 'linepay',
          method: 'LINE_PAY',
          amount: booking.total,
          status: 'SUCCESS',
          providerRef: transactionId,
          paidAt: new Date(),
        },
      })

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      // 此處可觸發 LINE 通知、發票等（已有現有邏輯）

      return NextResponse.json({ ok: true, status: 'PAID' })
    }

    // ===== 無 transactionId 時僅查詢狀態 =====
    return NextResponse.json({
      ok: true,
      status: booking.status,
    })
  } catch (error) {
    console.error('[API] POST /payments/confirm error:', error)
    return NextResponse.json(
      { ok: false, error: '確認支付失敗' },
      { status: 500 }
    )
  }
}
