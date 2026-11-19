'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, Eye, EyeOff, Trash2 } from 'lucide-react'
import { ntd } from '@/lib/utils'
import styles from './product-management.module.css'

// DEMO ONLY: removable product showcase
// 示範商品資料，之後可整段移除
const DEMO_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'DXD 進階碳纖維球拍',
    sku: 'DXD-RACKET-001',
    category: 'RACKET',
    price: 2500,
    published: true,
    stock: 15,
    createdAt: '2026-11-19',
  },
  {
    id: 'prod-2',
    name: 'DXD 俱樂部運動 T 恤',
    sku: 'DXD-APPAREL-001',
    category: 'APPAREL',
    price: 580,
    published: true,
    stock: 48,
    createdAt: '2026-11-19',
  },
  {
    id: 'prod-3',
    name: 'DXD 比賽用匹克球',
    sku: 'DXD-BALLS-001',
    category: 'BALLS',
    price: 450,
    published: false,
    stock: 60,
    createdAt: '2026-11-18',
  },
  {
    id: 'prod-4',
    name: 'DXD 球拍防震膠帶',
    sku: 'DXD-ACC-002',
    category: 'ACCESSORIES',
    price: 150,
    published: true,
    stock: 8,
    createdAt: '2026-11-18',
  },
]

const CATEGORY_LABEL: Record<string, string> = {
  RACKET: '球拍',
  APPAREL: '服飾',
  BALLS: '球類',
  ACCESSORIES: '配件',
}

export function ProductManagementClient() {
  const [products] = React.useState(DEMO_PRODUCTS)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>商品與商城管理</h1>
          <p className={styles.subtitle}>管理商品資料、價格、圖片與上架狀態</p>
        </div>
        <Button className={styles.addButton}>
          <Plus className="h-4 w-4 mr-2" aria-hidden />
          新增商品
        </Button>
      </div>

      {/* DEMO ONLY */}
      <div className={styles.demoLabel}>
        <span className={styles.demoBadge}>示範資料</span>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className={styles.tableTitle}>商品清單</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>商品名稱</th>
                  <th>SKU</th>
                  <th>分類</th>
                  <th>售價</th>
                  <th>庫存</th>
                  <th>上架狀態</th>
                  <th>建立日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className={styles.productName}>{product.name}</td>
                    <td className={styles.sku}>{product.sku}</td>
                    <td>{CATEGORY_LABEL[product.category]}</td>
                    <td className={styles.price}>{ntd(product.price)}</td>
                    <td className={styles.stock}>{product.stock}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          product.published
                            ? styles.badgePublished
                            : styles.badgeUnpublished
                        }`}
                      >
                        {product.published ? '已上架' : '已下架'}
                      </span>
                    </td>
                    <td className={styles.date}>{product.createdAt}</td>
                    <td className={styles.actions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={product.published ? '下架' : '上架'}
                      >
                        {product.published ? (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" title="編輯">
                        <Edit className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="sm" title="刪除">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.infoText}>
          💡 提示：修改商品價格、名稱、描述、分類或圖片時，變更會立即反映到前台商城。
        </p>
      </div>
    </div>
  )
}
