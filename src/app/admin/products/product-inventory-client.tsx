'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ArrowUp, ArrowDown, History } from 'lucide-react'
import styles from './product-inventory.module.css'

// DEMO ONLY: removable product showcase
// 示範庫存資料，之後可整段移除
const DEMO_INVENTORY_DATA = [
  {
    id: 'inv-1',
    productName: 'DXD 進階碳纖維球拍',
    sku: 'DXD-RACKET-001',
    currentQuantity: 15,
    reservedQuantity: 2,
    availableQuantity: 13,
    status: 'ACTIVE',
    lastModified: '2026-11-19',
  },
  {
    id: 'inv-2',
    productName: 'DXD 俱樂部運動 T 恤',
    sku: 'DXD-APPAREL-001',
    currentQuantity: 48,
    reservedQuantity: 5,
    availableQuantity: 43,
    status: 'ACTIVE',
    lastModified: '2026-11-19',
  },
  {
    id: 'inv-3',
    productName: 'DXD 比賽用匹克球',
    sku: 'DXD-BALLS-001',
    currentQuantity: 60,
    reservedQuantity: 8,
    availableQuantity: 52,
    status: 'ACTIVE',
    lastModified: '2026-11-19',
  },
  {
    id: 'inv-4',
    productName: 'DXD 球拍防震膠帶',
    sku: 'DXD-ACC-002',
    currentQuantity: 8,
    reservedQuantity: 0,
    availableQuantity: 8,
    status: 'LOW_STOCK',
    lastModified: '2026-11-18',
  },
]

export function ProductInventoryClient() {
  const [inventoryData] = React.useState(DEMO_INVENTORY_DATA)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>商品庫存</h1>
          <p className={styles.subtitle}>管理商品進貨、出貨與庫存異動</p>
        </div>
      </div>

      {/* DEMO ONLY: removable product showcase */}
      <div className={styles.demoLabel}>
        <span className={styles.demoBadge}>示範資料</span>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle className={styles.tableTitle}>庫存清單</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>商品名稱</th>
                  <th>SKU</th>
                  <th>目前庫存</th>
                  <th>保留庫存</th>
                  <th>可用庫存</th>
                  <th>狀態</th>
                  <th>最後異動</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.map((item) => (
                  <tr key={item.id} className={selectedId === item.id ? styles.rowSelected : ''}>
                    <td className={styles.productName}>{item.productName}</td>
                    <td className={styles.sku}>{item.sku}</td>
                    <td className={styles.quantity}>{item.currentQuantity}</td>
                    <td className={styles.quantity}>{item.reservedQuantity}</td>
                    <td className={styles.quantity}>{item.availableQuantity}</td>
                    <td>
                      <span
                        className={`${styles.status} ${styles[`status-${item.status.toLowerCase()}`]}`}
                      >
                        {item.status === 'ACTIVE' ? '有庫存' : '低庫存'}
                      </span>
                    </td>
                    <td className={styles.date}>{item.lastModified}</td>
                    <td className={styles.actions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(item.id)}
                        title="進貨"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(item.id)}
                        title="出貨"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(item.id)}
                        title="查看異動"
                      >
                        <History className="h-4 w-4" aria-hidden />
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
          💡 提示：進貨與出貨將自動更新庫存。庫存異動會記錄在時間軸中。
        </p>
      </div>
    </div>
  )
}
