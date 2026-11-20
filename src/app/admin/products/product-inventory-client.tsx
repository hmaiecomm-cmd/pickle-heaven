'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Plus, ArrowUp, ArrowDown, X, ChevronDown } from 'lucide-react'
import styles from './product-inventory.module.css'

const DEMO_INVENTORY_DATA = [
  {
    id: 'inv-1',
    productName: 'DXD 進階碳纖維球拍',
    sku: 'DXD-RACKET-001',
    currentQuantity: 15,
    reservedQuantity: 2,
    availableQuantity: 13,
    status: 'ACTIVE',
    lowStockThreshold: 10,
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
    lowStockThreshold: 20,
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
    lowStockThreshold: 30,
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
    lowStockThreshold: 15,
    lastModified: '2026-11-18',
  },
  {
    id: 'inv-5',
    productName: 'DXD 專業運動襪',
    sku: 'DXD-SOCKS-001',
    currentQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    status: 'OUT_OF_STOCK',
    lowStockThreshold: 10,
    lastModified: '2026-11-17',
  },
]

const DEMO_MOVEMENTS = [
  {
    id: 'mov-1',
    productId: 'inv-1',
    type: '進貨',
    quantity: 20,
    afterQuantity: 15,
    referenceId: 'PO-001',
    createdAt: '2026-11-19 14:30',
    createdBy: '林管理員',
    note: '補貨進貨',
  },
  {
    id: 'mov-2',
    productId: 'inv-1',
    type: '出貨',
    quantity: 5,
    afterQuantity: 10,
    referenceId: 'SO-001',
    createdAt: '2026-11-19 10:15',
    createdBy: '王管理員',
    note: '客戶訂單',
  },
  {
    id: 'mov-3',
    productId: 'inv-1',
    type: '訂單保留',
    quantity: 2,
    afterQuantity: 15,
    referenceId: 'PO-20261119-001',
    createdAt: '2026-11-19 09:00',
    createdBy: '系統',
    note: '',
  },
]

type InventoryItem = typeof DEMO_INVENTORY_DATA[0]
type Movement = typeof DEMO_MOVEMENTS[0]

export function ProductInventoryClient() {
  const [inventoryData, setInventoryData] = React.useState<InventoryItem[]>(DEMO_INVENTORY_DATA)
  const [selectedId, setSelectedId] = React.useState<string | null>('inv-1')
  const [searchTerm, setSearchTerm] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [inboundMode, setInboundMode] = React.useState(false)
  const [outboundMode, setOutboundMode] = React.useState(false)
  const [expandedMovement, setExpandedMovement] = React.useState<string | null>(null)
  const [movements, setMovements] = React.useState<Movement[]>(DEMO_MOVEMENTS)

  const [inboundForm, setInboundForm] = React.useState({
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    supplier: '',
    poNumber: '',
    note: '',
  })

  const [outboundForm, setOutboundForm] = React.useState({
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    shippingMethod: '黑貓宅配',
    trackingNumber: '',
    note: '',
  })

  const selectedItem = inventoryData.find((item) => item.id === selectedId)
  const selectedMovements = movements.filter((m) => m.productId === selectedId)

  const filteredData = inventoryData.filter((item) => {
    const matchSearch =
      item.productName.includes(searchTerm) || item.sku.includes(searchTerm)
    const matchStatus = statusFilter === 'all' || item.status === statusFilter
    return matchSearch && matchStatus
  })

  const kpiData = {
    totalProducts: inventoryData.length,
    totalStock: inventoryData.reduce((sum, item) => sum + item.currentQuantity, 0),
    lowStockCount: inventoryData.filter((item) => item.status === 'LOW_STOCK').length,
    outOfStockCount: inventoryData.filter((item) => item.status === 'OUT_OF_STOCK').length,
  }

  const handleInbound = () => {
    if (!selectedItem || !inboundForm.quantity || !selectedId) return

    const newItem = {
      ...selectedItem,
      currentQuantity: selectedItem.currentQuantity + parseInt(inboundForm.quantity),
    }
    newItem.availableQuantity = newItem.currentQuantity - newItem.reservedQuantity

    setInventoryData(inventoryData.map((item) => (item.id === selectedId ? newItem : item)))

    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      productId: selectedId,
      type: '進貨',
      quantity: parseInt(inboundForm.quantity),
      afterQuantity: newItem.currentQuantity,
      referenceId: inboundForm.poNumber || '-',
      createdAt: new Date().toLocaleString('zh-TW'),
      createdBy: '當前使用者',
      note: inboundForm.note,
    }

    setMovements([newMovement, ...movements])
    setInboundForm({ quantity: '', date: new Date().toISOString().split('T')[0], supplier: '', poNumber: '', note: '' })
    setInboundMode(false)
  }

  const handleOutbound = () => {
    if (!selectedItem || !outboundForm.quantity || !selectedId) return

    const qty = parseInt(outboundForm.quantity)
    if (qty > selectedItem.availableQuantity) {
      alert('可用庫存不足')
      return
    }

    const newItem = {
      ...selectedItem,
      currentQuantity: selectedItem.currentQuantity - qty,
    }
    newItem.availableQuantity = newItem.currentQuantity - newItem.reservedQuantity

    setInventoryData(inventoryData.map((item) => (item.id === selectedId ? newItem : item)))

    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      productId: selectedId,
      type: '出貨',
      quantity: qty,
      afterQuantity: newItem.currentQuantity,
      referenceId: outboundForm.trackingNumber || '-',
      createdAt: new Date().toLocaleString('zh-TW'),
      createdBy: '當前使用者',
      note: outboundForm.note,
    }

    setMovements([newMovement, ...movements])
    setOutboundForm({ quantity: '', date: new Date().toISOString().split('T')[0], shippingMethod: '黑貓宅配', trackingNumber: '', note: '' })
    setOutboundMode(false)
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>商品庫存</h1>
          <p className={styles.subtitle}>管理商品進貨、出貨與庫存異動</p>
        </div>
      </div>

      {/* Demo Badge */}
      <div className={styles.demoLabel}>
        <span className={styles.demoBadge}>示範資料</span>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <Card>
          <CardContent className={styles.kpiContent}>
            <div className={styles.kpiLabel}>商品總數</div>
            <div className={styles.kpiValue}>{kpiData.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.kpiContent}>
            <div className={styles.kpiLabel}>庫存總量</div>
            <div className={styles.kpiValue}>{kpiData.totalStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.kpiContent}>
            <div className={styles.kpiLabel}>低庫存商品</div>
            <div className={`${styles.kpiValue} ${styles.warning}`}>{kpiData.lowStockCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.kpiContent}>
            <div className={styles.kpiLabel}>缺貨商品</div>
            <div className={`${styles.kpiValue} ${styles.danger}`}>{kpiData.outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout */}
      <div className={styles.mainLayout}>
        {/* Left Panel - Inventory List */}
        <div className={styles.listPanel}>
          <Card>
            <CardHeader>
              <CardTitle className={styles.panelTitle}>庫存清單</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className={styles.filterGroup}>
                <Input
                  placeholder="搜尋商品名稱或 SKU"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className={styles.filterInput}
                />
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
                  <option value="all">全部狀態</option>
                  <option value="ACTIVE">庫存充足</option>
                  <option value="LOW_STOCK">低庫存</option>
                  <option value="OUT_OF_STOCK">缺貨</option>
                </select>
              </div>

              {/* Inventory List */}
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>商品名稱</th>
                      <th>SKU</th>
                      <th>目前庫存</th>
                      <th>保留</th>
                      <th>可用</th>
                      <th>狀態</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? styles.rowSelected : ''}
                        onClick={() => setSelectedId(item.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <td className={styles.productName}>{item.productName}</td>
                        <td className={styles.sku}>{item.sku}</td>
                        <td className={styles.quantity}>{item.currentQuantity}</td>
                        <td className={styles.quantity}>{item.reservedQuantity}</td>
                        <td className={styles.quantity}>{item.availableQuantity}</td>
                        <td>
                          <span
                            className={`${styles.status} ${styles[`status-${item.status.toLowerCase()}`]}`}
                          >
                            {item.status === 'ACTIVE' ? '充足' : item.status === 'LOW_STOCK' ? '低庫存' : '缺貨'}
                          </span>
                        </td>
                        <td className={styles.actions}>
                          <Button variant="ghost" size="sm" title="進貨">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="出貨">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Movement History & Actions */}
        {selectedItem && (
          <div className={styles.detailPanel}>
            {/* Detail Header */}
            <div className={styles.detailHeader}>
              <div>
                <h2 className={styles.detailTitle}>{selectedItem.productName}</h2>
                <p className={styles.detailSku}>{selectedItem.sku}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
              <Button
                onClick={() => setInboundMode(true)}
                className={styles.buttonPrimary}
              >
                <Plus className="h-4 w-4 mr-2" />
                進貨
              </Button>
              <Button
                onClick={() => setOutboundMode(true)}
                className={styles.buttonPrimary}
              >
                <Plus className="h-4 w-4 mr-2" />
                出貨
              </Button>
            </div>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className={styles.cardTitle}>庫存摘要</CardTitle>
              </CardHeader>
              <CardContent className={styles.summaryContent}>
                <div className={styles.summaryRow}>
                  <span>目前庫存</span>
                  <span className={styles.summaryValue}>{selectedItem.currentQuantity}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>保留庫存</span>
                  <span className={styles.summaryValue}>{selectedItem.reservedQuantity}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>可用庫存</span>
                  <span className={styles.summaryValue}>{selectedItem.availableQuantity}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>低庫存警示</span>
                  <span className={styles.summaryValue}>{selectedItem.lowStockThreshold}</span>
                </div>
              </CardContent>
            </Card>

            {/* Movement History */}
            <Card>
              <CardHeader>
                <CardTitle className={styles.cardTitle}>庫存異動</CardTitle>
              </CardHeader>
              <CardContent className={styles.movementContent}>
                {selectedMovements.length === 0 ? (
                  <p className={styles.emptyState}>無異動紀錄</p>
                ) : (
                  <div className={styles.timeline}>
                    {selectedMovements.map((movement) => (
                      <div key={movement.id} className={styles.timelineItem}>
                        <div
                          className={styles.timelineHeader}
                          onClick={() =>
                            setExpandedMovement(expandedMovement === movement.id ? null : movement.id)
                          }
                          role="button"
                          tabIndex={0}
                        >
                          <div>
                            <span
                              className={`${styles.movementType} ${styles[`type-${movement.type}`]}`}
                            >
                              {movement.type}
                            </span>
                            <span className={styles.movementQty}>
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </span>
                          </div>
                          <div className={styles.timelineInfo}>
                            <span className={styles.movementTime}>{movement.createdAt}</span>
                            <ChevronDown
                              className={`h-4 w-4 ${expandedMovement === movement.id ? styles.expanded : ''}`}
                            />
                          </div>
                        </div>
                        {expandedMovement === movement.id && (
                          <div className={styles.timelineDetail}>
                            <div className={styles.detailRow}>
                              <span>異動後庫存</span>
                              <span>{movement.afterQuantity}</span>
                            </div>
                            {movement.referenceId && (
                              <div className={styles.detailRow}>
                                <span>單號</span>
                                <span>{movement.referenceId}</span>
                              </div>
                            )}
                            <div className={styles.detailRow}>
                              <span>操作者</span>
                              <span>{movement.createdBy}</span>
                            </div>
                            {movement.note && (
                              <div className={styles.detailRow}>
                                <span>備註</span>
                                <span>{movement.note}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Inbound Modal */}
      {inboundMode && selectedItem && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>進貨 - {selectedItem.productName}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInboundMode(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>進貨數量 *</label>
                <Input
                  type="number"
                  value={inboundForm.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInboundForm({ ...inboundForm, quantity: e.target.value })}
                  placeholder="輸入進貨數量"
                />
              </div>
              <div className={styles.formGroup}>
                <label>進貨日期</label>
                <Input
                  type="date"
                  value={inboundForm.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInboundForm({ ...inboundForm, date: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>供應商</label>
                <Input
                  value={inboundForm.supplier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInboundForm({ ...inboundForm, supplier: e.target.value })}
                  placeholder="供應商名稱"
                />
              </div>
              <div className={styles.formGroup}>
                <label>進貨單號</label>
                <Input
                  value={inboundForm.poNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInboundForm({ ...inboundForm, poNumber: e.target.value })}
                  placeholder="進貨單號"
                />
              </div>
              <div className={styles.formGroup}>
                <label>備註</label>
                <Input
                  value={inboundForm.note}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInboundForm({ ...inboundForm, note: e.target.value })}
                  placeholder="備註"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="ghost"
                onClick={() => setInboundMode(false)}
              >
                取消
              </Button>
              <Button onClick={handleInbound}>
                儲存進貨紀錄
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Modal */}
      {outboundMode && selectedItem && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>出貨 - {selectedItem.productName}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOutboundMode(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>出貨數量 *</label>
                <Input
                  type="number"
                  value={outboundForm.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutboundForm({ ...outboundForm, quantity: e.target.value })}
                  placeholder="輸入出貨數量"
                />
                <p className={styles.helperText}>可用庫存: {selectedItem.availableQuantity}</p>
              </div>
              <div className={styles.formGroup}>
                <label>出貨日期</label>
                <Input
                  type="date"
                  value={outboundForm.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutboundForm({ ...outboundForm, date: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>配送方式</label>
                <Input
                  value={outboundForm.shippingMethod}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutboundForm({ ...outboundForm, shippingMethod: e.target.value })}
                  placeholder="黑貓宅配"
                />
              </div>
              <div className={styles.formGroup}>
                <label>物流編號</label>
                <Input
                  value={outboundForm.trackingNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutboundForm({ ...outboundForm, trackingNumber: e.target.value })}
                  placeholder="物流編號"
                />
              </div>
              <div className={styles.formGroup}>
                <label>備註</label>
                <Input
                  value={outboundForm.note}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutboundForm({ ...outboundForm, note: e.target.value })}
                  placeholder="備註"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="ghost"
                onClick={() => setOutboundMode(false)}
              >
                取消
              </Button>
              <Button onClick={handleOutbound}>
                建立出貨
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
