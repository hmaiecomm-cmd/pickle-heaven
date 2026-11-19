import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/product-management
 * 取得商品管理清單（商品名稱、圖片、描述、分類、價格、上架狀態）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const products = await prisma.product.findMany({
      include: { inventory: true },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      published: p.published,
      status: p.status,
      stock: p.inventory?.currentQuantity ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('[API] GET /admin/product-management error:', error)
    return NextResponse.json({ error: '取得商品失敗' }, { status: 500 })
  }
}

/**
 * POST /api/admin/product-management
 * 新增商品
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      sku,
      category,
      description,
      imageUrl,
      price,
      published,
      venueId,
    } = body

    if (!name || !sku || !category || !price) {
      return NextResponse.json({ error: '缺少必要資訊' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        category: category.toUpperCase(),
        description: description || null,
        imageUrl: imageUrl || null,
        price,
        published: published || false,
        status: 'INACTIVE',
        venueId,
      },
    })

    // 自動建立庫存記錄
    await prisma.productInventory.create({
      data: {
        productId: product.id,
        currentQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('[API] POST /admin/product-management error:', error)
    return NextResponse.json({ error: '新增商品失敗' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/product-management/:id
 * 修改商品（名稱、描述、圖片、分類、價格、上架狀態）
 * 注意：不修改庫存，庫存由 /api/admin/product-inventory 管理
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')
    const body = await request.json()

    if (!productId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json({ error: '商品不存在' }, { status: 404 })
    }

    // 只允許修改這些欄位（不包含庫存）
    const allowedFields = ['name', 'description', 'imageUrl', 'category', 'price', 'published']
    const updateData: any = {}

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'category') {
          updateData[field] = body[field].toUpperCase()
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // 更新上架狀態時，自動設定 status
    if ('published' in body) {
      updateData.status = body.published ? 'ACTIVE' : 'INACTIVE'
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[API] PATCH /admin/product-management error:', error)
    return NextResponse.json({ error: '修改商品失敗' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/product-management/:id
 * 刪除商品
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')

    if (!productId) {
      return NextResponse.json({ error: '缺少商品 ID' }, { status: 400 })
    }

    // 檢查是否有訂單
    const orderCount = await prisma.productOrderItem.count({
      where: { productId },
    })

    if (orderCount > 0) {
      return NextResponse.json(
        { error: '此商品有訂單，無法刪除' },
        { status: 400 }
      )
    }

    await prisma.product.delete({
      where: { id: productId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /admin/product-management error:', error)
    return NextResponse.json({ error: '刪除商品失敗' }, { status: 500 })
  }
}
