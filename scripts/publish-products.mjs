#!/usr/bin/env node
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

// 明確加載環境變數
const env = dotenv.config({ path: '.env.local' })
console.log('環境變數加載:', env.error ? '失敗' : '成功')

const dbUrl = process.env.TURSO_DATABASE_URL || 'libsql://pickle-heaven-dev-karajankjuo.aws-ap-northeast-1.turso.io'
const authToken = process.env.TURSO_AUTH_TOKEN

if (!dbUrl || !authToken) {
  console.error('❌ 缺少資料庫連接配置')
  console.log('TURSO_DATABASE_URL:', dbUrl ? '已設置' : '未設置')
  console.log('TURSO_AUTH_TOKEN:', authToken ? '已設置' : '未設置')
  process.exit(1)
}

console.log('📡 連接到 Turso...')
console.log('URL:', dbUrl.split('//')[1]?.split('.')[0] || dbUrl)

const client = createClient({
  url: dbUrl,
  authToken: authToken,
})

async function main() {
  console.log('🛍️ 正在檢查並發布商品...\n')

  try {
    // 查詢現有商品
    const existing = await client.execute('SELECT id, name, published FROM Product LIMIT 10')
    console.log('現有商品:')
    if (existing.rows.length === 0) {
      console.log('  尚無商品，正在建立...\n')

      // 先查詢場館 ID
      const venues = await client.execute('SELECT id, name FROM Venue LIMIT 1')
      if (venues.rows.length === 0) {
        console.error('❌ 沒有找到場館')
        process.exit(1)
      }
      const venueId = venues.rows[0].id

      // 建立 4 個商品
      const products = [
        {
          sku: 'DEMO-RACKET-001',
          name: '碳纖維進階球拍',
          category: 'RACKET',
          description: '高性能碳纖維材質，適合進階玩家',
          price: 89900,
        },
        {
          sku: 'DEMO-APPAREL-001',
          name: '專業比賽服',
          category: 'APPAREL',
          description: '透氣快乾運動服裝',
          price: 29900,
        },
        {
          sku: 'DEMO-BALLS-001',
          name: '官方比賽用球',
          category: 'BALLS',
          description: '符合 USPA 認證',
          price: 3990,
        },
        {
          sku: 'DEMO-ACCESSORIES-001',
          name: '球拍保護套',
          category: 'ACCESSORIES',
          description: '防震設計',
          price: 1490,
        },
      ]

      for (const p of products) {
        await client.execute({
          sql: `INSERT INTO Product (id, venueId, sku, name, category, description, price, published, status)
                VALUES (cuid(), ?, ?, ?, ?, ?, ?, 1, 'ACTIVE')`,
          args: [venueId, p.sku, p.name, p.category, p.description, p.price],
        })
        console.log(`  ✅ ${p.name}`)
      }
    } else {
      existing.rows.forEach((row) => {
        console.log(`  ${row.published ? '✅' : '❌'} ${row.name}`)
      })

      // 發布所有未發布的商品
      console.log('\n📢 發布所有商品...')
      await client.execute('UPDATE Product SET published = 1 WHERE published = 0')
      console.log('  ✅ 完成')
    }

    console.log('\n✨ 商品已就緒！')
    console.log('🛍️ 商城: https://pickle-heaven.vercel.app/shop')
  } catch (error) {
    console.error('❌ 錯誤:', error.message)
    process.exit(1)
  }
}

main()
