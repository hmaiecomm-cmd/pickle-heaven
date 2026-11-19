import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/product-inventory
 * 取得商品庫存清單（後台）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const inventories = await prisma.productInventory.findMany({
      include: {
        product: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { product: { createdAt: 'desc' } },
    })

    const formatted = inventories.map((inv) => ({
      id: inv.id,
      productId: inv.product.id,
      productName: inv.product.name,
      sku: inv.product.sku,
      currentQuantity: inv.currentQuantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.availableQuantity,
      status: inv.product.status,
      lastModified: inv.updatedAt.toISOString(),
      recentTransactions: inv.transactions,
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('[API] GET /admin/product-inventory error:', error)
    return NextResponse.json({ error: '取得庫存失敗' }, { status: 500 })
  }
}

/**
 * POST /api/admin/product-inventory/inbound
 * 進貨
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await request.json()
    const { inventoryId, quantity, vendor, note } = body

    if (!inventoryId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    const inventory = await prisma.productInventory.findUnique({
      where: { id: inventoryId },
      include: { product: true },
    })

    if (!inventory) {
      return NextResponse.json({ error: '庫存不存在' }, { status: 404 })
    }

    // 更新庫存
    const updated = await prisma.productInventory.update({
      where: { id: inventoryId },
      data: {
        currentQuantity: { increment: quantity },
        availableQuantity: { increment: quantity },
      },
    })

    // 記錄異動
    await prisma.inventoryTransaction.create({
      data: {
        inventoryId,
        type: 'INBOUND',
        quantity,
        balanceAfter: updated.currentQuantity,
        vendor,
        note: note || `進貨 ${quantity} 件`,
      },
    })

    // 更新商品狀態
    if (inventory.product.status === 'LOW_STOCK' && updated.currentQuantity > inventory.product.lowStockThreshold) {
      await prisma.product.update({
        where: { id: inventory.product.id },
        data: { status: 'ACTIVE' },
      })
    }

    return NextResponse.json({ success: true, inventory: updated })
  } catch (error) {
    console.error('[API] POST /admin/product-inventory/inbound error:', error)
    return NextResponse.json({ error: '進貨失敗' }, { status: 500 })
  }
}
