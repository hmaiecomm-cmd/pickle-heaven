import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'

/**
 * GET /api/products
 * 取得前台上架商品清單
 * 篩選條件：published=true、status!='INACTIVE'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where: any = {
      published: true,
      status: { not: 'INACTIVE' },
    }

    if (category && category !== 'ALL') {
      where.category = category.toUpperCase()
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        description: true,
        imageUrl: true,
        price: true,
        status: true,
        inventory: {
          select: {
            currentQuantity: true,
            reservedQuantity: true,
            availableQuantity: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 轉換為前端格式
    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      stockQuantity: product.inventory?.currentQuantity ?? 0,
      reservedQuantity: product.inventory?.reservedQuantity ?? 0,
      availableQuantity: product.inventory?.availableQuantity ?? 0,
      published: true,
      status: product.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json(formattedProducts)
  } catch (error) {
    console.error('[API] GET /products error:', error)
    return NextResponse.json({ error: '取得商品失敗' }, { status: 500 })
  }
}
