import { NextRequest, NextResponse } from 'next/server'
import { ensureCartToken, getCartToken } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getCart } from '@/lib/availability'

/**
 * POST /api/cart-product
 * 加入商品到購物車
 */
export async function POST(request: NextRequest) {
  try {
    const cartToken = await ensureCartToken()
    const body = await request.json()
    const { productId, quantity } = body

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    // 驗證商品存在且可販售
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    })

    if (!product) {
      return NextResponse.json({ error: '商品不存在' }, { status: 404 })
    }

    if (!product.published || product.status === 'INACTIVE') {
      return NextResponse.json({ error: '商品已下架' }, { status: 400 })
    }

    if (!product.inventory || product.inventory.availableQuantity < quantity) {
      return NextResponse.json(
        {
          error: `「${product.name}」庫存不足，可購買數量：${product.inventory?.availableQuantity ?? 0}`,
        },
        { status: 400 }
      )
    }

    // 新增或更新購物車商品
    const cartItem = await prisma.cartProduct.upsert({
      where: { cartToken_productId: { cartToken, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartToken, productId, quantity },
    })

    // 回傳最新購物車
    const cart = await getCart(cartToken)

    return NextResponse.json({
      success: true,
      cart,
      item: cartItem,
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
    const cartToken = await getCartToken()
    if (!cartToken) {
      return NextResponse.json({ error: '無法取得購物車' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('id')

    if (!itemId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    // 驗證商品屬於此購物車
    const item = await prisma.cartProduct.findUnique({
      where: { id: itemId },
    })

    if (!item || item.cartToken !== cartToken) {
      return NextResponse.json({ error: '商品不存在或無權限' }, { status: 404 })
    }

    // 刪除購物車項目
    await prisma.cartProduct.delete({ where: { id: itemId } })

    // 回傳最新購物車
    const cart = await getCart(cartToken)

    return NextResponse.json({ success: true, cart })
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
    const cartToken = await getCartToken()
    if (!cartToken) {
      return NextResponse.json({ error: '無法取得購物車' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('id')
    const body = await request.json()
    const { quantity } = body

    if (!itemId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: '數量必須大於 0' }, { status: 400 })
    }

    // 驗證商品屬於此購物車
    const item = await prisma.cartProduct.findUnique({
      where: { id: itemId },
      include: { product: { include: { inventory: true } } },
    })

    if (!item || item.cartToken !== cartToken) {
      return NextResponse.json({ error: '商品不存在或無權限' }, { status: 404 })
    }

    // 驗證庫存足夠
    const availableQuantity = item.product.inventory?.availableQuantity ?? 0
    if (availableQuantity < quantity) {
      return NextResponse.json(
        {
          error: `「${item.product.name}」庫存不足，可購買數量：${availableQuantity}`,
        },
        { status: 400 }
      )
    }

    // 更新數量
    const updated = await prisma.cartProduct.update({
      where: { id: itemId },
      data: { quantity },
    })

    // 回傳最新購物車
    const cart = await getCart(cartToken)

    return NextResponse.json({ success: true, cart, item: updated })
  } catch (error) {
    console.error('[API] PATCH /cart-product error:', error)
    return NextResponse.json({ error: '更新商品失敗' }, { status: 500 })
  }
}
