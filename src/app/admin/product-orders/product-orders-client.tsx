'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/card'
import { AlertCircle, Clock, Truck, CreditCard, RefreshCw } from 'lucide-react'
import { ntd } from '@/lib/utils'
import styles from './product-orders.module.css'

// DEMO ONLY: removable product showcase
// 示範訂單資料，之後可整段移除
const DEMO_ORDERS = [
  {
    id: 'ord-1',
    code: 'PO-20261119-001',
    customerName: '王小明',
    productCount: 2,
    total: 3080,
    paymentStatus: 'PAID',
    shippingStatus: 'PROCESSING',
    createdAt: '2026-11-19',
    items: [
      { productName: 'DXD 進階碳纖維球拍', sku: 'DXD-RACKET-001', quantity: 1, unitPrice: 2500 },
      { productName: 'DXD 球拍防震膠帶', sku: 'DXD-ACC-002', quantity: 2, unitPrice: 290 },
    ],
    recipientName: '王小明',
    recipientPhone: '0912-345-678',
    recipientAddress: '台北市中山區中山路100號',
    shippingMethod: '黑貓宅配',
  },
  {
    id: 'ord-2',
    code: 'PO-20261119-002',
    customerName: '李欣穎',
    productCount: 1,
    total: 580,
    paymentStatus: 'PENDING',
    shippingStatus: 'PENDING',
    createdAt: '2026-11-19',
    items: [{ productName: 'DXD 俱樂部運動 T 恤', sku: 'DXD-APPAREL-001', quantity: 1, unitPrice: 580 }],
    recipientName: '李欣穎',
    recipientPhone: '0923-456-789',
    recipientAddress: '新北市板橋區文化路1號',
    shippingMethod: null,
  },
  {
    id: 'ord-3',
    code: 'PO-20261118-003',
    customerName: '陳建宏',
    productCount: 1,
    total: 450,
    paymentStatus: 'PAID',
    shippingStatus: 'SHIPPED',
    createdAt: '2026-11-18',
    items: [{ productName: 'DXD 比賽用匹克球', sku: 'DXD-BALLS-001', quantity: 3, unitPrice: 150 }],
    recipientName: '陳建宏',
    recipientPhone: '0934-567-890',
    recipientAddress: '台中市西屯區中港路200號',
    shippingMethod: '黑貓宅配',
  },
]

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待付款',
  PAID: '已付款',
  FAILED: '付款失敗',
  REFUNDED: '已退款',
}

const SHIPPING_STATUS_LABEL: Record<string, string> = {
  PENDING: '待出貨',
  PROCESSING: '處理中',
  SHIPPED: '已出貨',
  DELIVERED: '已完成',
  CANCELLED: '取消',
}

export function ProductOrdersClient() {
  const [orders] = React.useState(DEMO_ORDERS)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(DEMO_ORDERS[0].id)

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Left Panel - Orders List */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h1 className={styles.title}>客戶訂單</h1>
            <p className={styles.subtitle}>共 {orders.length} 筆訂單</p>
          </div>

          {/* DEMO ONLY */}
          <div className={styles.demoLabel}>
            <span className={styles.demoBadge}>示範資料</span>
          </div>

          <div className={styles.ordersList}>
            {orders.map((order) => (
              <div
                key={order.id}
                className={`${styles.orderItem} ${selectedOrderId === order.id ? styles.orderItemActive : ''}`}
                onClick={() => setSelectedOrderId(order.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedOrderId(order.id)
                }}
              >
                <div className={styles.orderItemHeader}>
                  <div>
                    <p className={styles.orderCode}>{order.code}</p>
                    <p className={styles.customerName}>{order.customerName}</p>
                  </div>
                  <p className={styles.orderTotal}>{ntd(order.total)}</p>
                </div>
                <div className={styles.orderItemStatus}>
                  <span
                    className={`${styles.badge} ${styles[`badge-${order.paymentStatus.toLowerCase()}`]}`}
                  >
                    {PAYMENT_STATUS_LABEL[order.paymentStatus]}
                  </span>
                  <span
                    className={`${styles.badge} ${styles[`badge-${order.shippingStatus.toLowerCase()}`]}`}
                  >
                    {SHIPPING_STATUS_LABEL[order.shippingStatus]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Order Detail */}
        <div className={styles.detailPanel}>
          {selectedOrder ? (
            <>
              {/* Detail Header */}
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{selectedOrder.code}</h2>
                <p className={styles.detailDate}>{selectedOrder.createdAt}</p>
              </div>

              <div className={styles.detailContent}>
                {/* Order Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className={styles.cardTitle}>訂單摘要</CardTitle>
                  </CardHeader>
                  <CardContent className={styles.summaryContent}>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>客戶名稱</span>
                      <span className={styles.summaryValue}>{selectedOrder.customerName}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>訂單金額</span>
                      <span className={styles.summaryValue}>{ntd(selectedOrder.total)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>付款狀態</span>
                      <span
                        className={`${styles.badge} ${styles[`badge-${selectedOrder.paymentStatus.toLowerCase()}`]}`}
                      >
                        {PAYMENT_STATUS_LABEL[selectedOrder.paymentStatus]}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>出貨狀態</span>
                      <span
                        className={`${styles.badge} ${styles[`badge-${selectedOrder.shippingStatus.toLowerCase()}`]}`}
                      >
                        {SHIPPING_STATUS_LABEL[selectedOrder.shippingStatus]}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Product Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className={styles.cardTitle}>商品明細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={styles.itemsList}>
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx}>
                          <div className={styles.itemRow}>
                            <div className={styles.itemInfo}>
                              <p className={styles.itemName}>{item.productName}</p>
                              <p className={styles.itemSku}>{item.sku}</p>
                            </div>
                            <div className={styles.itemPrice}>
                              <span>×{item.quantity}</span>
                              <span>{ntd(item.unitPrice)}</span>
                            </div>
                          </div>
                          {idx < selectedOrder.items.length - 1 && <Separator className="my-2" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className={styles.cardTitle}>收件資訊</CardTitle>
                  </CardHeader>
                  <CardContent className={styles.shippingContent}>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>收件人</span>
                      <span className={styles.summaryValue}>{selectedOrder.recipientName}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>聯絡電話</span>
                      <span className={styles.summaryValue}>{selectedOrder.recipientPhone}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>收件地址</span>
                      <span className={styles.summaryValue}>{selectedOrder.recipientAddress}</span>
                    </div>
                    {selectedOrder.shippingMethod && (
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>出貨方式</span>
                        <span className={styles.summaryValue}>{selectedOrder.shippingMethod}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                  <Button variant="primary" className={styles.buttonPrimary}>
                    <Truck className="h-4 w-4 mr-2" aria-hidden />
                    標記出貨
                  </Button>
                  <Button variant="secondary">
                    <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                    查看退款
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <AlertCircle className="h-12 w-12 text-muted" aria-hidden />
              <p>選擇一筆訂單以查看詳細資料</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
