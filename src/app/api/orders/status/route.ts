import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * GET /api/orders/status/:orderId
 * 查詢訂單狀態（場地租借 + 商品訂單）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const orderType = searchParams.get('type') // 'booking' or 'product'

    if (!orderId || !orderType) {
      return NextResponse.json({ error: '缺少訂單資訊' }, { status: 400 })
    }

    if (orderType === 'booking') {
      const booking = await prisma.booking.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { court: true } },
          payments: true,
          refunds: true,
          cancellationLog: true,
        },
      })

      if (!booking || booking.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      return NextResponse.json({
        type: 'booking',
        order: booking,
        status: booking.status,
        paymentStatus: booking.status === 'PAID' ? 'SUCCESS' : 'PENDING',
        timeline: generateBookingTimeline(booking),
      })
    }

    if (orderType === 'product') {
      const order = await prisma.productOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          payments: true,
          refunds: true,
        },
      })

      if (!order || order.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      return NextResponse.json({
        type: 'product',
        order,
        status: order.status,
        paymentStatus: order.paymentStatus,
        shippingStatus: order.shippingStatus,
        timeline: generateProductOrderTimeline(order),
      })
    }

    return NextResponse.json({ error: '無效的訂單類型' }, { status: 400 })
  } catch (error) {
    console.error('[API] GET /orders/status error:', error)
    return NextResponse.json({ error: '查詢訂單狀態失敗' }, { status: 500 })
  }
}

/**
 * PATCH /api/orders/cancel
 * 取消訂單（場地租借訂單）
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, orderType, reason } = body

    if (!orderId || !orderType) {
      return NextResponse.json({ error: '缺少訂單資訊' }, { status: 400 })
    }

    if (orderType === 'booking') {
      const booking = await prisma.booking.findUnique({
        where: { id: orderId },
        include: { items: true, reservations: true },
      })

      if (!booking || booking.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      // 檢查是否可以取消
      if (!['PENDING', 'PAID'].includes(booking.status)) {
        return NextResponse.json({ error: '此訂單無法取消' }, { status: 400 })
      }

      // 更新訂單狀態
      const updated = await prisma.booking.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          lastCancelAttempt: new Date(),
          cancelAttemptReason: reason,
        },
      })

      // 釋放預訂時段
      for (const reservation of booking.reservations) {
        if (reservation.status === 'HELD' || reservation.status === 'BOOKED') {
          await prisma.reservation.delete({
            where: { id: reservation.id },
          })
        }
      }

      // 建立取消日誌
      await prisma.cancellationLog.create({
        data: {
          bookingId: orderId,
          status: 'SUCCESS',
          rejectionReason: reason || undefined,
        },
      })

      return NextResponse.json({
        success: true,
        message: '訂單已取消',
        order: updated,
      })
    }

    if (orderType === 'product') {
      const order = await prisma.productOrder.findUnique({
        where: { id: orderId },
        include: { items: true, refunds: true },
      })

      if (!order || order.userId !== user.id) {
        return NextResponse.json({ error: '訂單不存在或無權限' }, { status: 404 })
      }

      // 檢查是否可以取消
      if (!['PENDING', 'PAID'].includes(order.status)) {
        return NextResponse.json({ error: '此訂單無法取消' }, { status: 400 })
      }

      // 更新訂單狀態
      const updated = await prisma.productOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })

      // 建立退款記錄
      if (order.paymentStatus === 'SUCCESS' && order.total > 0) {
        await prisma.productRefund.create({
          data: {
            orderId,
            reason: reason || 'User cancelled',
            amount: order.total,
            status: 'PENDING',
          },
        })
      }

      // 回沖保留庫存
      for (const item of order.items) {
        const inventory = await prisma.productInventory.findUnique({
          where: { productId: item.productId },
        })

        if (inventory) {
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
              orderReference: order.code,
              note: `訂單 ${order.code} 取消，庫存回沖`,
            },
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: '訂單已取消，已建立退款申請',
        order: updated,
      })
    }

    return NextResponse.json({ error: '無效的訂單類型' }, { status: 400 })
  } catch (error) {
    console.error('[API] PATCH /orders/cancel error:', error)
    return NextResponse.json({ error: '取消訂單失敗' }, { status: 500 })
  }
}

// 輔助函式：生成場地租借訂單時間軸
function generateBookingTimeline(booking: any) {
  const timeline = []

  if (booking.createdAt) {
    timeline.push({
      time: booking.createdAt,
      event: '訂單建立',
      status: 'created',
    })
  }

  if (booking.paidAt) {
    timeline.push({
      time: booking.paidAt,
      event: '已付款',
      status: 'paid',
    })
  }

  if (booking.checkedInAt) {
    timeline.push({
      time: booking.checkedInAt,
      event: '已簽到',
      status: 'checked_in',
    })
  }

  if (booking.cancelledAt) {
    timeline.push({
      time: booking.cancelledAt,
      event: '已取消',
      status: 'cancelled',
    })
  }

  return timeline
}

// 輔助函式：生成商品訂單時間軸
function generateProductOrderTimeline(order: any) {
  const timeline = []

  if (order.createdAt) {
    timeline.push({
      time: order.createdAt,
      event: '訂單建立',
      status: 'created',
    })
  }

  if (order.paidAt) {
    timeline.push({
      time: order.paidAt,
      event: '已付款',
      status: 'paid',
    })
  }

  if (order.shippedAt) {
    timeline.push({
      time: order.shippedAt,
      event: '已出貨',
      status: 'shipped',
    })
  }

  if (order.deliveredAt) {
    timeline.push({
      time: order.deliveredAt,
      event: '已送達',
      status: 'delivered',
    })
  }

  if (order.cancelledAt) {
    timeline.push({
      time: order.cancelledAt,
      event: '已取消',
      status: 'cancelled',
    })
  }

  return timeline
}
