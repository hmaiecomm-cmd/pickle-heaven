'use client'

import * as React from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEMO_PRODUCTS } from './demo-products'
import { ProductCard } from '@/components/shop/product-card'
import { CategoryFilter } from '@/components/shop/category-filter'
import type { ProductCategory } from '@/lib/types'
import styles from './shop.module.css'

export function ShopClient() {
  const [selectedCategory, setSelectedCategory] = React.useState<ProductCategory | 'ALL'>('ALL')

  // DEMO ONLY: removable product showcase
  // 示範商品資料，之後可整段移除
  const products = DEMO_PRODUCTS

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

      {/* DEMO ONLY: removable product showcase */}
      {/* 示範商品展示區塊，之後可整段移除 */}
      <section className={styles.shopDemoShowcase}>
        <div className={styles.shopDemoLabel}>
          <span className={styles.shopDemoBadge}>示範商品</span>
        </div>

        {/* 商品網格 */}
        <div className={styles.shopProductsGrid}>
          {filteredProducts.length > 0 ? (
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
