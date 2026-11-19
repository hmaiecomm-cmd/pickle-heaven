import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/refunds
 * 申請退款（商品訂單）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, reason, amount } = body

    if (!orderId || !reason || !amount || amount <= 0) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    const order = await prisma.productOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        refunds: true,
      },
    })

    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
    }

    // 驗證訂單狀態
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: '已取消的訂單無法退款' }, { status: 400 })
    }

    if (order.paymentStatus !== 'SUCCESS' && order.paymentStatus !== 'PENDING') {
      return NextResponse.json({ error: '此訂單無法退款' }, { status: 400 })
    }

    // 驗證退款金額不超過訂單金額
    const totalRefunded = order.refunds.reduce((sum, r) => sum + (r.amount || 0), 0)
    if (totalRefunded + amount > order.total) {
      return NextResponse.json(
        { error: `退款金額超過訂單金額，已退款：${totalRefunded}，本次申請：${amount}` },
        { status: 400 }
      )
    }

    // 建立退款記錄
    const refund = await prisma.productRefund.create({
      data: {
        orderId,
        reason,
        amount,
        status: 'PENDING',
        requestedAt: new Date(),
      },
    })

    // 更新訂單退款狀態
    await prisma.productOrder.update({
      where: { id: orderId },
      data: {
        status: amount >= order.total ? 'CANCELLED' : 'PAID', // 全額退款則取消訂單
      },
    })

    return NextResponse.json({
      success: true,
      refund,
      message: '退款申請已提交，請稍候處理',
    })
  } catch (error) {
    console.error('[API] POST /refunds error:', error)
    return NextResponse.json({ error: '申請退款失敗' }, { status: 500 })
  }
}

/**
 * GET /api/refunds
 * 取得個人退款清單
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const refunds = await prisma.productRefund.findMany({
      where: {
        order: { userId: user.id },
      },
      include: {
        order: {
          select: {
            code: true,
            total: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(refunds)
  } catch (error) {
    console.error('[API] GET /refunds error:', error)
    return NextResponse.json({ error: '取得退款清單失敗' }, { status: 500 })
  }
}

/**
 * PATCH /api/refunds/:id
 * 後台：處理退款（ADMIN only）
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const refundId = searchParams.get('id')
    const body = await request.json()
    const { status, transactionId, note } = body

    if (!refundId) {
      return NextResponse.json({ error: '缺少退款 ID' }, { status: 400 })
    }

    if (!['PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) {
      return NextResponse.json({ error: '無效的狀態' }, { status: 400 })
    }

    const refund = await prisma.productRefund.findUnique({
      where: { id: refundId },
      include: { order: true },
    })

    if (!refund) {
      return NextResponse.json({ error: '退款不存在' }, { status: 404 })
    }

    // 更新退款記錄
    const updated = await prisma.productRefund.update({
      where: { id: refundId },
      data: {
        status,
        transactionId: transactionId || undefined,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
      include: { order: true },
    })

    // 如果退款完成，回沖庫存
    if (status === 'COMPLETED' && refund.order.status === 'PAID') {
      const orderItems = await prisma.productOrderItem.findMany({
        where: { orderId: refund.orderId },
      })

      for (const item of orderItems) {
        const inventory = await prisma.productInventory.findUnique({
          where: { productId: item.productId },
        })

        if (inventory) {
          // 恢復庫存
          await prisma.productInventory.update({
            where: { id: inventory.id },
            data: {
              reservedQuantity: { decrement: item.quantity },
              availableQuantity: { increment: item.quantity },
            },
          })

          // 記錄異動
          await prisma.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: 'UNRESERVATION',
              quantity: item.quantity,
              balanceAfter: inventory.currentQuantity,
              orderReference: refund.order.code,
              note: `訂單 ${refund.order.code} 退款，庫存回沖`,
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      refund: updated,
      message: `退款已${status === 'COMPLETED' ? '完成' : '處理中'}`,
    })
  } catch (error) {
    console.error('[API] PATCH /refunds error:', error)
    return NextResponse.json({ error: '處理退款失敗' }, { status: 500 })
  }
}
