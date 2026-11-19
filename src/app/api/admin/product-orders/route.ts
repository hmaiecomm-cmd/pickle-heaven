import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/product-orders
 * 取得全部商品訂單列表（後台）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: any = {}
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus

    const orders = await prisma.productOrder.findMany({
      where,
      include: {
        user: { select: { displayName: true, email: true } },
        items: { include: { product: true } },
        payments: true,
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('[API] GET /admin/product-orders error:', error)
    return NextResponse.json({ error: '取得訂單失敗' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/product-orders/:id
 * 更新訂單狀態（標記出貨、完成等）
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('id')
    const body = await request.json()
    const { shippingStatus, trackingNumber, shippingMethod } = body

    if (!orderId) {
      return NextResponse.json({ error: '缺少訂單 ID' }, { status: 400 })
    }

    const order = await prisma.productOrder.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    }

    // 標記出貨時，自動扣除庫存
    if (shippingStatus === 'SHIPPED') {
      for (const item of order.items) {
        const inventory = await prisma.productInventory.findUnique({
          where: { productId: item.productId },
        })

        if (inventory) {
          // 扣除目前庫存、取消預留
          await prisma.productInventory.update({
            where: { id: inventory.id },
            data: {
              currentQuantity: { decrement: item.quantity },
              reservedQuantity: { decrement: item.quantity },
              availableQuantity: { decrement: item.quantity },
            },
          })

          // 記錄出貨異動
          await prisma.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: 'OUTBOUND',
              quantity: -item.quantity,
              balanceAfter: inventory.currentQuantity - item.quantity,
              orderReference: order.code,
              note: `訂單 ${order.code} 出貨`,
            },
          })
        }
      }
    }

    // 更新訂單
    const updated = await prisma.productOrder.update({
      where: { id: orderId },
      data: {
        shippingStatus,
        trackingNumber: trackingNumber || undefined,
        shippingMethod: shippingMethod || undefined,
        shippedAt: shippingStatus === 'SHIPPED' ? new Date() : undefined,
        deliveredAt: shippingStatus === 'DELIVERED' ? new Date() : undefined,
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        refunds: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[API] PATCH /admin/product-orders error:', error)
    return NextResponse.json({ error: '更新訂單失敗' }, { status: 500 })
  }
}
