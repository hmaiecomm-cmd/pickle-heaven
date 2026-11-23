import { prisma } from '@/lib/db'

async function main() {
  // 獲取第一個場館（假設已有場館）
  const venue = await prisma.venue.findFirst()

  if (!venue) {
    console.error('❌ 沒有找到場館，請先建立場館')
    process.exit(1)
  }

  console.log(`📍 使用場館: ${venue.name}`)

  // 刪除舊的 DEMO 商品（如果存在）
  await prisma.product.deleteMany({
    where: {
      sku: {
        in: ['DEMO-RACKET-001', 'DEMO-APPAREL-001', 'DEMO-BALLS-001', 'DEMO-ACCESSORIES-001'],
      },
    },
  })

  // 建立 4 個分類的商品
  const products = await Promise.all([
    prisma.product.create({
      data: {
        venueId: venue.id,
        sku: 'DEMO-RACKET-001',
        name: '碳纖維進階球拍',
        category: 'RACKET',
        description: '高性能碳纖維材質，適合進階玩家',
        price: 89900,
        published: true,
        status: 'ACTIVE',
        lowStockThreshold: 10,
      },
    }),
    prisma.product.create({
      data: {
        venueId: venue.id,
        sku: 'DEMO-APPAREL-001',
        name: '專業比賽服',
        category: 'APPAREL',
        description: '透氣快乾運動服裝，適合激烈運動',
        price: 29900,
        published: true,
        status: 'ACTIVE',
        lowStockThreshold: 5,
      },
    }),
    prisma.product.create({
      data: {
        venueId: venue.id,
        sku: 'DEMO-BALLS-001',
        name: '官方比賽用球',
        category: 'BALLS',
        description: '符合 USPA 認證的正式比賽用球',
        price: 3990,
        published: true,
        status: 'ACTIVE',
        lowStockThreshold: 20,
      },
    }),
    prisma.product.create({
      data: {
        venueId: venue.id,
        sku: 'DEMO-ACCESSORIES-001',
        name: '球拍保護套',
        category: 'ACCESSORIES',
        description: '防震設計，保護您的球拍',
        price: 1490,
        published: true,
        status: 'ACTIVE',
        lowStockThreshold: 10,
      },
    }),
  ])

  // 為每個商品建立庫存記錄
  await Promise.all(
    products.map((product) =>
      prisma.productInventory.create({
        data: {
          productId: product.id,
          currentQuantity: product.sku === 'DEMO-BALLS-001' ? 200 : product.sku === 'DEMO-APPAREL-001' ? 100 : 50,
          reservedQuantity: 0,
          availableQuantity: product.sku === 'DEMO-BALLS-001' ? 200 : product.sku === 'DEMO-APPAREL-001' ? 100 : 50,
        },
      }),
    ),
  )

  console.log('✅ 商品已建立完成！')
  console.log('\n📊 新增商品清單：')
  products.forEach((p) => {
    console.log(`  • ${p.name} (${p.category}) - NT$${p.price}`)
  })
  console.log('\n🛍️ 商城: https://pickle-heaven.vercel.app/shop')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
