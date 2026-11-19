'use client'

import * as React from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/shop/product-card'
import { CategoryFilter } from '@/components/shop/category-filter'
import type { ProductCategory, Product } from '@/lib/types'
import styles from './shop.module.css'

export function ShopClient() {
  const [selectedCategory, setSelectedCategory] = React.useState<ProductCategory | 'ALL'>('ALL')
  const [products, setProducts] = React.useState<Product[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // 載入商品
  React.useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/products')
        if (!res.ok) throw new Error('無法載入商品')
        const data = await res.json()
        setProducts(data)
      } catch (err) {
        console.error('[Shop] Load products error:', err)
        setError('無法載入商品，請稍後再試')
      } finally {
        setIsLoading(false)
      }
    }
    loadProducts()
  }, [])

  const filteredProducts =
    selectedCategory === 'ALL' ? products : products.filter((p) => p.category === selectedCategory)

  const categories: Array<{ value: ProductCategory | 'ALL'; label: string }> = [
    { value: 'ALL', label: '全部' },
    { value: 'RACKET', label: '球拍' },
    { value: 'APPAREL', label: '服飾' },
    { value: 'BALLS', label: '球類' },
    { value: 'ACCESSORIES', label: '配件' },
  ]

  return (
    <div className={styles.shopContainer}>
      {/* 商城頁面主視覺 */}
      <section className={styles.shopHero}>
        <div className={styles.shopHeroContent}>
          <h1 className={styles.shopHeroTitle}>DXD 商城</h1>
          <p className={styles.shopHeroSubtitle}>運動裝備一應俱全</p>
        </div>
      </section>

      {/* 商品分類 */}
      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* 商品展示區塊 */}
      <section className={styles.shopDemoShowcase}>
        {/* 商品網格 */}
        <div className={styles.shopProductsGrid}>
          {isLoading ? (
            <div className={styles.shopEmptyState}>
              <ShoppingCart className="h-12 w-12 text-muted" aria-hidden />
              <p className="text-muted">載入商品中...</p>
            </div>
          ) : error ? (
            <div className={styles.shopEmptyState}>
              <ShoppingCart className="h-12 w-12 text-red-400" aria-hidden />
              <p className="text-red-600">{error}</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <div className={styles.shopEmptyState}>
              <ShoppingCart className="h-12 w-12 text-muted" aria-hidden />
              <p className="text-muted">此分類暫無商品</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
