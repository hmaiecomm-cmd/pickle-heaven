'use client'

import * as React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ProductDetailDialog } from './product-detail-dialog'
import type { Product } from '@/lib/types'
import { ntd } from '@/lib/utils'
import styles from './product-card.module.css'

interface ProductCardProps {
  product: Product
}

const CATEGORY_LABEL: Record<string, string> = {
  RACKET: '球拍',
  APPAREL: '服飾',
  BALLS: '球類',
  ACCESSORIES: '配件',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '有庫存',
  INACTIVE: '已下架',
  LOW_STOCK: '庫存不足',
  SOLD_OUT: '已售完',
}

export function ProductCard({ product }: ProductCardProps) {
  const [showDetail, setShowDetail] = React.useState(false)

  return (
    <>
      <article className={styles.card}>
        {/* Product Image */}
        <div className={styles.imageContainer}>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={240}
              height={240}
              className={styles.image}
              onError={(e) => {
                // Fallback to placeholder on image load error
                ;(e.target as HTMLImageElement).src = '/placeholder-product.jpg'
              }}
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              <span className={styles.placeholderText}>無圖片</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className={styles.content}>
          <p className={styles.category}>{CATEGORY_LABEL[product.category] || product.category}</p>
          <h3 className={styles.name}>{product.name}</h3>
          <p className={styles.price}>{ntd(product.price)}</p>

          {/* Stock Status */}
          <div className={styles.statusContainer}>
            <span className={`${styles.status} ${styles[`status-${product.status.toLowerCase()}`]}`}>
              {STATUS_LABEL[product.status] || product.status}
            </span>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              className={styles.buttonOutline}
              onClick={() => setShowDetail(true)}
            >
              查看商品
            </Button>
            <Button
              size="sm"
              className={styles.buttonPrimary}
              disabled={product.status === 'SOLD_OUT' || product.status === 'INACTIVE'}
            >
              加入購物車
            </Button>
          </div>
        </div>
      </article>

      {/* Product Detail Dialog */}
      <ProductDetailDialog product={product} open={showDetail} onOpenChange={setShowDetail} />
    </>
  )
}
