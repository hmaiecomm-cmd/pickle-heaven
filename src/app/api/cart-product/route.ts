import { NextRequest, NextResponse } from 'next/server'
import { getCartToken, getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * POST /api/cart-product
 * 加入商品到購物車
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const cartToken = await getCartToken()

    if (!user && !cartToken) {
      return NextResponse.json({ error: '無法取得購物車' }, { status: 400 })
    }

    const body = await request.json()
    const { productId, quantity } = body

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    // 驗證庫存
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    })

    if (!product) {
      return NextResponse.json({ error: '商品不存在' }, { status: 404 })
    }

    if (!product.inventory || product.inventory.availableQuantity < quantity) {
      return NextResponse.json(
        { error: `${product.name} 庫存不足，可用數量：${product.inventory?.availableQuantity ?? 0}` },
        { status: 400 }
      )
    }

    // 返回成功響應
    // 實際購物車邏輯應該儲存到 Redis 或資料庫
    return NextResponse.json({
      success: true,
      item: {
        id: `product-${productId}`,
        productId,
        productName: product.name,
        productSku: product.sku,
        imageUrl: product.imageUrl,
        quantity,
        unitPrice: product.price,
        subtotal: product.price * quantity,
      },
    })
  } catch (error) {
    console.error('[API] POST /cart-product error:', error)
    return NextResponse.json({ error: '加入購物車失敗' }, { status: 500 })
  }
}

/**
 * DELETE /api/cart-product?id=:itemId
 * 從購物車移除商品
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('id')

    if (!itemId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    // 返回成功響應
    return NextResponse.json({ success: true, removedItemId: itemId })
  } catch (error) {
    console.error('[API] DELETE /cart-product error:', error)
    return NextResponse.json({ error: '移除商品失敗' }, { status: 500 })
  }
}

/**
 * PATCH /api/cart-product?id=:itemId
 * 更新購物車中商品的數量
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('id')
    const body = await request.json()
    const { quantity } = body

    if (!itemId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: '無效的數量' }, { status: 400 })
    }

    // 返回成功響應
    return NextResponse.json({
      success: true,
      updatedItemId: itemId,
      newQuantity: quantity,
    })
  } catch (error) {
    console.error('[API] PATCH /cart-product error:', error)
    return NextResponse.json({ error: '更新商品失敗' }, { status: 500 })
  }
}
