import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/product-orders
 * 建立新的商品訂單
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const body = await request.json()
    const {
      venueId,
      items,
      recipientName,
      recipientPhone,
      recipientAddress,
      shippingMethod,
    } = body

    if (!venueId || !items?.length) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    // 驗證庫存
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      })

      if (!product) {
        return NextResponse.json(
          { error: `商品 ${item.productId} 不存在` },
          { status: 404 }
        )
      }

      if (!product.inventory || product.inventory.availableQuantity < item.quantity) {
        return NextResponse.json(
          { error: `${product.name} 庫存不足` },
          { status: 400 }
        )
      }
    }

    // 計算訂單金額
    const subtotal = await Promise.all(
      items.map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        })
        return (product?.price ?? 0) * item.quantity
      })
    ).then((prices) => prices.reduce((a, b) => a + b, 0))

    // 生成訂單編號
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    const code = `PO-${dateStr}-${sequence}`

    // 建立訂單
    const order = await prisma.productOrder.create({
      data: {
        code,
        userId: user.id,
        venueId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        shippingStatus: 'PENDING',
        subtotal,
        total: subtotal,
        recipientName: recipientName || user.displayName,
        recipientPhone: recipientPhone || user.phone || '',
        recipientAddress: recipientAddress || '',
        shippingMethod,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.unitPrice * item.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // 預留庫存
    for (const item of items) {
      const inventory = await prisma.productInventory.findUnique({
        where: { productId: item.productId },
      })

      if (inventory) {
        await prisma.productInventory.update({
          where: { id: inventory.id },
          data: {
            reservedQuantity: { increment: item.quantity },
            availableQuantity: { decrement: item.quantity },
          },
        })

        // 記錄庫存異動
        await prisma.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            type: 'RESERVATION',
            quantity: item.quantity,
            balanceAfter: inventory.currentQuantity - item.quantity,
            orderReference: order.code,
            note: `訂單 ${order.code} 庫存預留`,
          },
        })
      }
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('[API] POST /product-orders error:', error)
    return NextResponse.json({ error: '建立訂單失敗' }, { status: 500 })
  }
}

/**
 * GET /api/product-orders
 * 取得個人商品訂單列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '需要登入' }, { status: 401 })
    }

    const orders = await prisma.productOrder.findMany({
      where: { userId: user.id },
      include: {
        items: true,
        payments: true,
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('[API] GET /product-orders error:', error)
    return NextResponse.json({ error: '取得訂單失敗' }, { status: 500 })
  }
}
