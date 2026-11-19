'use client'

import * as React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { X, Minus, Plus } from 'lucide-react'
import type { Product } from '@/lib/types'
import { ntd } from '@/lib/utils'
import styles from './product-detail-dialog.module.css'

interface ProductDetailDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function ProductDetailDialog({ product, open, onOpenChange }: ProductDetailDialogProps) {
  const { toast } = useToast()
  const [quantity, setQuantity] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleAddToCart = async () => {
    if (product.availableQuantity <= 0) {
      toast('此商品目前無庫存', 'error')
      return
    }

    if (quantity > product.availableQuantity) {
      toast(`庫存不足，可購買數量：${product.availableQuantity}`, 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/cart-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast(error.error || '加入購物車失敗', 'error')
        return
      }

      toast(`已將 ${quantity} 件「${product.name}」加入購物車`, 'success')
      setQuantity(1)
      onOpenChange(false)
    } catch (error) {
      console.error('[Dialog] Add to cart error:', error)
      toast('加入購物車失敗', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const isOutOfStock = product.status === 'SOLD_OUT' || product.status === 'INACTIVE' || product.availableQuantity <= 0

  return (
    <>
      {open && (
        <div className={styles.backdrop} onClick={() => onOpenChange(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.header}>
              <h2 className={styles.title}>商品詳細</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => onOpenChange(false)}
                aria-label="關閉"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              <div className={styles.imageSection}>
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={300}
                    height={300}
                    className={styles.image}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/placeholder-product.jpg'
                    }}
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <span>無圖片</span>
                  </div>
                )}
              </div>

              <div className={styles.infoSection}>
                <div>
                  <p className={styles.category}>{CATEGORY_LABEL[product.category] || product.category}</p>
                  <h3 className={styles.name}>{product.name}</h3>
                  <p className={styles.description}>{product.description}</p>

                  {/* Price & Stock */}
                  <Card className={styles.priceCard}>
                    <CardContent className={styles.priceContent}>
                      <div>
                        <p className={styles.label}>商品價格</p>
                        <p className={styles.price}>{ntd(product.price)}</p>
                      </div>
                      <div>
                        <p className={styles.label}>庫存狀態</p>
                        <p
                          className={`${styles.status} ${styles[`status-${product.status.toLowerCase()}`]}`}
                        >
                          {STATUS_LABEL[product.status] || product.status}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quantity & Action */}
                <div className={styles.actionSection}>
                  <div>
                    <label htmlFor="quantity" className={styles.label}>
                      購買數量
                    </label>
                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1 || isOutOfStock}
                        className={styles.quantityButton}
                        aria-label="減少"
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </button>
                      <input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={isOutOfStock}
                        min="1"
                        max={product.availableQuantity}
                        className={styles.quantityInput}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(Math.min(product.availableQuantity, quantity + 1))
                        }
                        disabled={quantity >= product.availableQuantity || isOutOfStock}
                        className={styles.quantityButton}
                        aria-label="增加"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isLoading}
                    className={styles.addButton}
                  >
                    {isLoading ? '加入中...' : '加入購物車'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
