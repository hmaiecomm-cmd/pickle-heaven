// 通過 API 添加商品到線上資料庫
const baseUrl = 'https://pickle-heaven.vercel.app'

const products = [
  {
    sku: 'DEMO-RACKET-001',
    name: '碳纖維進階球拍',
    category: 'RACKET',
    description: '高性能碳纖維材質，適合進階玩家',
    price: 89900,
    stock: 50,
  },
  {
    sku: 'DEMO-APPAREL-001',
    name: '專業比賽服',
    category: 'APPAREL',
    description: '透氣快乾運動服裝，適合激烈運動',
    price: 29900,
    stock: 100,
  },
  {
    sku: 'DEMO-BALLS-001',
    name: '官方比賽用球',
    category: 'BALLS',
    description: '符合 USPA 認證的正式比賽用球',
    price: 3990,
    stock: 200,
  },
  {
    sku: 'DEMO-ACCESSORIES-001',
    name: '球拍保護套',
    category: 'ACCESSORIES',
    description: '防震設計，保護您的球拍',
    price: 1490,
    stock: 80,
  },
]

async function addProducts() {
  console.log('🛍️  正在添加商品到 Pickle Heaven 商城...\n')

  for (const product of products) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/product-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...product,
          published: true,
          status: 'ACTIVE',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`❌ ${product.name}: ${response.status} ${error}`)
        continue
      }

      const data = await response.json()
      console.log(`✅ ${product.name} (${product.category}) - NT$${product.price}`)
    } catch (error) {
      console.error(`❌ ${product.name}: ${error}`)
    }
  }

  console.log('\n🎉 商品添加完成！')
  console.log('📍 商城頁面: https://pickle-heaven.vercel.app/shop')
}

addProducts()
