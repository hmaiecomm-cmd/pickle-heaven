'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, Eye, EyeOff, Trash2 } from 'lucide-react'
import { ntd } from '@/lib/utils'
import styles from './product-management.module.css'

type Product = {
  id: string
  name: string
  sku: string
  category: string
  price: number
  published: boolean
  stock: number
  createdAt: string
  description?: string
}

const CATEGORY_LABEL: Record<string, string> = {
  RACKET: '球拍',
  APPAREL: '服飾',
  BALLS: '球類',
  ACCESSORIES: '配件',
}

export function ProductManagementClient() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // 載入商品清單
  React.useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/admin/product-management')
        if (!response.ok) {
          throw new Error('載入商品清單失敗')
        }
        const data = await response.json()
        setProducts(data.products || data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知錯誤')
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>商品與商城管理</h1>
            <p className={styles.subtitle}>管理商品資料、價格、圖片與上架狀態</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted">載入中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

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

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-700">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className={styles.tableTitle}>商品清單（{products.length} 件）</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <p className="text-muted text-center py-8">尚無商品，點選「新增商品」建立商品</p>
            </div>
          ) : (
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
                      <td>{CATEGORY_LABEL[product.category] || product.category}</td>
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
          )}
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
