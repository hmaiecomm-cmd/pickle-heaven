import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getPaymentProvider, PaymentError } from '@/lib/payments'

/**
 * POST /api/payments/initiate
 *
 * 初始化支付流程
 *
 * 請求體（JSON）：
 * {
 *   "bookingId": "...",
 *   "providerId": "newebpay" | "linepay" | "tappay"
 * }
 *
 * 回應（成功）：
 * {
 *   "ok": true,
 *   "instruction": {
 *     "kind": "redirect" | "form" | "client",
 *     ...
 *   },
 *   "metadata": { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const { bookingId, providerId } = body

    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { error: '缺少或無效的 bookingId' },
        { status: 400 }
      )
    }

    // ===== 訂單驗證 =====
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: true,
        activityItems: { where: { status: 'ACTIVE' } },
        venue: true,
        user: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: '訂單不存在' },
        { status: 404 }
      )
    }

    if (booking.userId !== user.id) {
      return NextResponse.json(
        { error: '無權限存取此訂單' },
        { status: 403 }
      )
    }

    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        {
          ok: false,
          error: '訂單狀態不允許支付',
          currentStatus: booking.status,
        },
        { status: 400 }
      )
    }

    if (booking.total === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: '全額折抵，無須支付',
          info: { bookingId, total: 0 },
        },
        { status: 400 }
      )
    }

    if (booking.expiresAt && booking.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: '訂單保留時間已逾期' },
        { status: 400 }
      )
    }

    // ===== 支付方式驗證 =====
    let provider
    try {
      provider = getPaymentProvider(
        providerId && typeof providerId === 'string' ? providerId : undefined
      )
    } catch (err) {
      const msg = err instanceof PaymentError ? err.message : '金流商配置無效'
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 400 }
      )
    }

    if (!provider.isConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: `${provider.displayName} 尚未設定完成`,
          provider: { id: provider.id, displayName: provider.displayName },
        },
        { status: 503 }
      )
    }

    // ===== 生成金流指示 =====
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const instruction = await provider.createCharge({
      bookingId: booking.id,
      bookingCode: booking.code,
      amount: booking.total,
      description: [
        booking.items.length > 0 ? `場地租借 ${booking.items.length} 個時段` : '',
        booking.activityItems.length > 0 ? `活動報名 ${booking.activityItems.length} 場` : '',
      ]
        .filter(Boolean)
        .join('、')
        .replace(/^/, `${booking.venue.name} `),
      itemNames: [
        ...booking.items.map((i) => `場地 ${i.courtName} ${i.rateName}`),
        ...booking.activityItems.map((i) => `活動 ${i.title} ×${i.quantity}`),
      ],
      customer: {
        name: booking.contactName,
        phone: booking.contactPhone,
        email: booking.user.email,
      },
      returnUrl: `${appUrl}/checkout/result?booking=${booking.id}`,
      notifyUrl: `${appUrl}/api/payments/${provider.id}/notify`,
      cancelUrl: `${appUrl}/checkout/${booking.id}`,
    })

    return NextResponse.json({
      ok: true,
      instruction,
      metadata: {
        bookingCode: booking.code,
        amount: booking.total,
        provider: provider.id,
      },
    })
  } catch (err) {
    console.error('[API] POST /payments/initiate error:', err)

    if (err instanceof PaymentError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { ok: false, error: '初始化支付失敗，請稍後重試' },
      { status: 500 }
    )
  }
}
