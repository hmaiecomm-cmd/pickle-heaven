# 商城系統實裝完整指南

**實裝日期**: 2026-11-19  
**系統**: 顧好 AI 智慧場館平台  
**版本**: Phase 1 - 基礎商城系統

---

## 📋 實裝範圍

### ✅ 已完成
- [x] 資料庫模型（Product、ProductInventory、ProductOrder 等）
- [x] 前台商城頁面（/shop）
- [x] 商品卡片元件與商品詳細對話框
- [x] 商品分類篩選
- [x] 右側選單新增「商城」選項
- [x] 後台商品庫存管理頁面（/admin/products）
- [x] 後台客戶訂單管理頁面（/admin/product-orders）
- [x] 後台商品與商城管理頁面（/admin/product-management）
- [x] 完整 API 端點（詳見下方）
- [x] DEMO 資料集（清楚標記，可隨時移除）

### ⏳ 下一步（待實裝）
- [x] 購物車系統整合（API 已實裝）
- [x] 支付流程框架（API 已實裝，待 LINE Pay/信用卡整合）
- [x] 訂單確認通知（API 已實裝，待郵件/LINE 整合）
- [ ] 訂單退款流程
- [ ] 商品編輯表單（詳細編輯頁面）
- [ ] 庫存低庫存提醒系統
- [ ] 物流追蹤整合
- [ ] 商品評論與評分

---

## 🗺️ 前台路由

### 商城頁面
- **路由**: `/shop`
- **功能**: 
  - 展示上架商品清單
  - 按分類篩選（球拍、服飾、球類、配件）
  - 查看商品詳細資訊
  - 加入購物車
  - DEMO 商品展示區塊

### 商品詳細
- **方式**: Modal 對話框（點擊「查看商品」）
- **內容**: 商品圖、名稱、分類、描述、價格、庫存、數量選擇、加入購物車

---

## 🛠️ 後台路由

### 商品與商城管理
- **路由**: `/admin/product-management`
- **權限**: ADMIN
- **功能**:
  - 商品清單（名稱、SKU、分類、價格、庫存、上架狀態）
  - 新增商品（預留表單實裝空間）
  - 編輯商品（預留表單實裝空間）
  - 上架/下架商品
  - 刪除商品
  - 修改商品名稱、描述、圖片、分類、價格

**責任**:
- ✓ 商品名稱、描述、圖片、分類
- ✓ 商品售價
- ✓ 商品上架/下架狀態
- ✓ 前台行銷內容
- ✗ 庫存管理（由商品庫存頁面負責）
- ✗ 訂單管理（由客戶訂單頁面負責）

### 商品庫存
- **路由**: `/admin/products`
- **權限**: ADMIN / STAFF
- **功能**:
  - 庫存清單（商品、SKU、目前庫存、保留庫存、可用庫存、狀態、最後異動）
  - 進貨（預留表單實裝空間）
  - 出貨（預留表單實裝空間）
  - 查看庫存異動時間軸
  - 低庫存提醒

**責任**:
- ✓ 目前庫存管理
- ✓ 保留庫存管理
- ✓ 進貨異動紀錄
- ✓ 出貨異動紀錄
- ✓ 庫存狀態更新
- ✗ 商品售價（由商品與商城管理頁面負責）
- ✗ 商品上架狀態（由商品與商城管理頁面負責）

### 客戶訂單
- **路由**: `/admin/product-orders`
- **權限**: ADMIN / STAFF
- **模式**: 左側列表 + 右側詳細（沿用訂場訂單設計）
- **功能**:
  - 訂單清單（訂單編號、客戶、商品、金額、付款狀態、出貨狀態、下單時間）
  - 訂單詳細：訂單摘要、商品明細、收件資訊、付款紀錄、出貨狀態、操作時間軸
  - 標記出貨（自動扣除庫存、記錄異動）
  - 查看退款
  - 訂單狀態篩選（待付款、已付款、等）

**責任**:
- ✓ 客戶購買訂單管理
- ✓ 付款狀態追蹤
- ✓ 出貨狀態管理
- ✓ 訂單操作時間軸
- ✗ 商品庫存管理（由商品庫存頁面負責）
- ✗ 商品價格管理（由商品與商城管理頁面負責）

---

## 🔌 API 端點

### 前台 API

#### GET `/api/products`
**取得前台上架商品清單**

參數：
- `category` (optional): `RACKET|APPAREL|BALLS|ACCESSORIES` - 商品分類

響應：
```typescript
[{
  id: string
  name: string
  sku: string
  category: ProductCategory
  description: string
  imageUrl: string | null
  price: number
  stockQuantity: number
  reservedQuantity: number
  availableQuantity: number
  published: boolean
  status: 'ACTIVE' | 'INACTIVE' | 'LOW_STOCK' | 'SOLD_OUT'
  createdAt: string
  updatedAt: string
}]
```

**篩選邏輯**:
- `published === true`
- `status !== 'INACTIVE'`

---

#### POST `/api/product-orders`
**建立新的商品訂單**

需登入會員

請求：
```typescript
{
  venueId: string
  items: [{
    productId: string
    productName: string
    productSku: string
    quantity: number
    unitPrice: number
  }]
  recipientName?: string
  recipientPhone?: string
  recipientAddress: string
  shippingMethod?: string
}
```

功能：
- ✓ 驗證庫存
- ✓ 計算訂單金額
- ✓ 生成訂單編號（PO-YYYYMMDD-###）
- ✓ 預留庫存（reservedQuantity + availableQuantity -）
- ✓ 記錄庫存異動（RESERVATION）

---

#### GET `/api/product-orders`
**取得個人商品訂單清單**

需登入會員

響應：
```typescript
[{
  id: string
  code: string
  status: ProductOrderStatus
  paymentStatus: PaymentStatus
  shippingStatus: string // PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED
  total: number
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  shippingMethod?: string
  paidAt?: string
  shippedAt?: string
  deliveredAt?: string
  createdAt: string
  items: [{
    productId: string
    productName: string
    productSku: string
    quantity: number
    unitPrice: number
    subtotal: number
  }]
}]
```

---

### 後台 API

#### GET `/api/admin/product-management`
**取得商品管理清單**

權限：ADMIN

響應：
```typescript
[{
  id: string
  name: string
  sku: string
  category: string
  description?: string
  imageUrl?: string
  price: number
  published: boolean
  status: string
  stock: number
  createdAt: string
  updatedAt: string
}]
```

---

#### POST `/api/admin/product-management`
**新增商品**

權限：ADMIN

請求：
```typescript
{
  name: string
  sku: string
  category: string // RACKET|APPAREL|BALLS|ACCESSORIES
  description?: string
  imageUrl?: string
  price: number
  published?: boolean
  venueId: string
}
```

功能：
- ✓ 建立 Product 記錄
- ✓ 自動建立 ProductInventory 記錄（初始庫存=0）

---

#### PATCH `/api/admin/product-management?id=:productId`
**修改商品**

權限：ADMIN

請求（只允許這些欄位）：
```typescript
{
  name?: string
  description?: string
  imageUrl?: string
  category?: string
  price?: number
  published?: boolean // 修改時自動設定 status=ACTIVE|INACTIVE
}
```

**禁止修改**:
- 庫存相關欄位（由 /api/admin/product-inventory 管理）

---

#### DELETE `/api/admin/product-management?id=:productId`
**刪除商品**

權限：ADMIN

功能：
- ✓ 檢查是否有訂單
- ✓ 若有訂單則拒絕刪除
- ✓ 刪除成功則移除相關 ProductInventory

---

#### GET `/api/admin/product-inventory`
**取得商品庫存清單（後台）**

權限：ADMIN / STAFF

響應：
```typescript
[{
  id: string
  productId: string
  productName: string
  sku: string
  currentQuantity: number
  reservedQuantity: number
  availableQuantity: number
  status: string
  lastModified: string
  recentTransactions: InventoryTransaction[]
}]
```

---

#### POST `/api/admin/product-inventory`
**進貨**

權限：ADMIN / STAFF

請求：
```typescript
{
  inventoryId: string
  quantity: number
  vendor?: string
  note?: string
}
```

功能：
- ✓ 增加 currentQuantity
- ✓ 增加 availableQuantity
- ✓ 記錄 InventoryTransaction（INBOUND）
- ✓ 自動更新商品狀態（若達到低庫存閾值以上）

---

#### POST `/api/cart-product`
**加入商品到購物車**

需登入會員

請求：
```typescript
{
  productId: string
  quantity: number
}
```

響應：
```typescript
{
  success: boolean
  item: {
    id: string
    productId: string
    productName: string
    productSku: string
    imageUrl: string | null
    quantity: number
    unitPrice: number
    subtotal: number
  }
}
```

功能：
- ✓ 驗證庫存
- ✓ 返回購物車項目信息

---

#### DELETE `/api/cart-product?id=:itemId`
**從購物車移除商品**

需登入會員

---

#### PATCH `/api/cart-product?id=:itemId`
**更新購物車中商品的數量**

需登入會員

請求：
```typescript
{
  quantity: number
}
```

---

#### POST `/api/payments/initiate`
**初始化支付流程**

需登入會員

請求：
```typescript
{
  bookingId?: string // 場地租借訂單
  productOrderId?: string // 商品訂單
  paymentMethod: 'LINE_PAY' | 'CREDIT_CARD'
  amount: number
}
```

響應（LINE Pay）：
```typescript
{
  transactionId: string
  paymentMethod: 'LINE_PAY'
  amount: number
  redirectUrl: string // 重定向到 LINE Pay 付款頁面
}
```

功能：
- ✓ 驗證訂單存在性和權限
- ✓ 驗證訂單狀態（必須為 PENDING）
- ✓ 生成唯一交易編號
- ✓ 返回支付方法特定資訊

---

#### POST `/api/payments/confirm`
**確認支付完成**

需登入會員

請求：
```typescript
{
  transactionId: string
  bookingId?: string
  productOrderId?: string
  paymentMethod: 'LINE_PAY' | 'CREDIT_CARD'
  amount: number
}
```

功能：
- ✓ 驗證訂單和權限
- ✓ 更新訂單狀態（PAID）
- ✓ 建立付款記錄
- ✓ 返回更新後的訂單信息

---

#### POST `/api/orders/send-confirmation`
**發送訂單確認郵件和 LINE 通知**

需登入會員

請求：
```typescript
{
  bookingId?: string
  productOrderId?: string
  notificationType?: 'email' | 'line' | 'all' // 預設 'all'
}
```

響應：
```typescript
{
  success: boolean
  notifications: [{
    type: 'EMAIL' | 'LINE'
    status: 'PENDING' | 'SENT'
    recipient?: string // 郵件地址
    userId?: string // LINE 用戶 ID
    message: string
  }]
  message: string
}
```

功能：
- ✓ 生成訂單確認郵件內容
- ✓ 生成 LINE 通知內容
- ✓ 標記為待發送
- ✓ 支持場地租借和商品訂單

---

#### GET `/api/admin/product-orders`
**取得全部商品訂單列表（後台）**

權限：ADMIN / STAFF

參數：
- `status` (optional): 訂單狀態篩選
- `paymentStatus` (optional): 付款狀態篩選

響應：
```typescript
[{
  id: string
  code: string
  user: { displayName: string; email?: string }
  status: ProductOrderStatus
  paymentStatus: PaymentStatus
  shippingStatus: string
  subtotal: number
  total: number
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  shippingMethod?: string
  createdAt: string
  items: [{
    id: string
    productName: string
    productSku: string
    quantity: number
    unitPrice: number
    subtotal: number
  }]
  payments: []
  refunds: []
}]
```

---

#### PATCH `/api/admin/product-orders?id=:orderId`
**更新訂單狀態**

權限：ADMIN / STAFF

請求：
```typescript
{
  shippingStatus: string // SHIPPED|DELIVERED|CANCELLED 等
  trackingNumber?: string
  shippingMethod?: string
}
```

功能（標記出貨時）：
- ✓ 自動扣除 currentQuantity（原始庫存）
- ✓ 自動扣除 reservedQuantity（預留庫存）
- ✓ 自動扣除 availableQuantity（可用庫存）
- ✓ 記錄 InventoryTransaction（OUTBOUND）
- ✓ 設定 shippedAt 時間戳

---

## 📊 資料模型

### Product（商品）
```typescript
{
  id: string @id
  venueId: string
  sku: string @unique
  name: string
  category: ProductCategory // RACKET|APPAREL|BALLS|ACCESSORIES
  description?: string
  imageUrl?: string
  price: number // 新台幣整數元
  published: boolean // 上架狀態
  status: string // ACTIVE|INACTIVE|LOW_STOCK|SOLD_OUT
  lowStockThreshold: number // 低庫存警告閾值，預設 10
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relations
  venue: Venue
  inventory?: ProductInventory
  orderItems: ProductOrderItem[]
}
```

### ProductInventory（庫存）
```typescript
{
  id: string @id
  productId: string @unique
  currentQuantity: number // 目前庫存
  reservedQuantity: number // 保留庫存（待付款訂單）
  availableQuantity: number // 可用庫存 = current - reserved
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relations
  product: Product
  transactions: InventoryTransaction[]
}
```

### InventoryTransaction（庫存異動）
```typescript
{
  id: string @id
  inventoryId: string
  type: InventoryTransactionType // INBOUND|OUTBOUND|ADJUSTMENT|RESERVATION|UNRESERVATION
  quantity: number // 異動數量（負數=減少）
  balanceAfter: number // 異動後的庫存量
  orderReference?: string // 相關訂單編號
  vendor?: string // 供應商（進貨時）
  note?: string // 備註
  createdAt: DateTime
  
  // Relations
  inventory: ProductInventory
}
```

### ProductOrder（商品訂單）
```typescript
{
  id: string @id
  code: string @unique // PO-YYYYMMDD-###
  userId: string
  venueId: string
  status: ProductOrderStatus
  paymentStatus: PaymentStatus // PENDING|SUCCESS|FAILED|REFUNDED
  shippingStatus: string // PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED
  subtotal: number
  discount: number
  total: number
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  shippingMethod?: string
  trackingNumber?: string
  paidAt?: DateTime
  shippedAt?: DateTime
  deliveredAt?: DateTime
  cancelledAt?: DateTime
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relations
  user: User
  venue: Venue
  items: ProductOrderItem[]
  payments: ProductPayment[]
  refunds: ProductRefund[]
}
```

### ProductOrderItem（訂單明細）
```typescript
{
  id: string @id
  orderId: string
  productId: string
  productName: string // 下單時的快照
  productSku: string // 下單時的快照
  quantity: number
  unitPrice: number // 下單時的價格
  subtotal: number // quantity × unitPrice
  createdAt: DateTime
  
  // Relations
  order: ProductOrder
  product: Product
}
```

---

## 🎨 前台設計

### 商城頁面風格
- 延續官網深紫色運動俱樂部風格
- 黑色頁首、DXD Logo、品牌文字保留
- 深色球場主視覺
- 深紫色背景與紫色透明區塊
- 白色繁體中文文字

### 響應式設計
- **電腦版**: 商品卡片 4 欄（240px）、分類篩選用按鈕
- **平板橫式**: 商品卡片 2-3 欄、分類篩選用按鈕或下拉
- **手機版**: 商品卡片單欄（100%）、分類篩選下拉選單

### DEMO 區塊位置
- **路徑**: `src/app/shop/demo-products.ts`
- **標記**: `// DEMO ONLY: removable product showcase`
- **移除方式**: 刪除檔案 + 修改 shop-client.tsx 以連接真實資料源

---

## 🗑️ DEMO 資料移除清單

當切換到正式資料源時，依序移除：

### 1. 前台商城 DEMO 資料
```bash
# 刪除示範商品檔案
rm src/app/shop/demo-products.ts

# 修改 src/app/shop/shop-client.tsx
# - 移除 import { DEMO_PRODUCTS }
# - 改用 API 或資料庫取得商品
# const products = await fetch('/api/products')
```

### 2. 後台庫存 DEMO 資料
```bash
# 修改 src/app/admin/products/product-inventory-client.tsx
# - 移除 DEMO_INVENTORY_DATA 常數
# - 改用 API 取得庫存
```

### 3. 後台訂單 DEMO 資料
```bash
# 修改 src/app/admin/product-orders/product-orders-client.tsx
# - 移除 DEMO_ORDERS 常數
# - 改用 API 取得訂單
```

### 4. 後台商品管理 DEMO 資料
```bash
# 修改 src/app/admin/product-management/product-management-client.tsx
# - 移除 DEMO_PRODUCTS 常數
# - 改用 API 取得商品
```

---

## 🔄 資料流向

```
┌─────────────────────────────────────────────────────────┐
│                   前台商城 (/shop)                       │
│  - 展示上架商品 (GET /api/products)                     │
│  - 分類篩選                                              │
│  - 加入購物車 → 建立訂單 (POST /api/product-orders)    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│              後台客戶訂單 (/admin/product-orders)         │
│  - 查看訂單 (GET /api/admin/product-orders)             │
│  - 標記出貨 (PATCH /api/admin/product-orders)           │
│    └→ 自動扣除庫存、記錄異動                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│              後台商品庫存 (/admin/products)              │
│  - 查看庫存 (GET /api/admin/product-inventory)          │
│  - 進貨 (POST /api/admin/product-inventory)             │
│  - 查看異動時間軸                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          後台商品管理 (/admin/product-management)         │
│  - 管理商品資訊 (GET/POST/PATCH/DELETE)                 │
│  - 修改名稱、價格、圖片、上架狀態                         │
│  └→ 變更立即反映到前台商城                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 檔案清單

### 新增前台檔案
```
src/app/shop/
├── page.tsx
├── shop-client.tsx
├── shop.module.css
└── demo-products.ts (DEMO ONLY)

src/components/shop/
├── product-card.tsx
├── product-card.module.css
├── product-detail-dialog.tsx
├── product-detail-dialog.module.css
├── category-filter.tsx
└── category-filter.module.css
```

### 新增後台檔案
```
src/app/admin/product-management/
├── page.tsx
├── product-management-client.tsx (DEMO ONLY)
└── product-management.module.css

src/app/admin/products/
├── page.tsx
├── product-inventory-client.tsx (DEMO ONLY)
└── product-inventory.module.css

src/app/admin/product-orders/
├── page.tsx
├── product-orders-client.tsx (DEMO ONLY)
└── product-orders.module.css
```

### 新增 API 檔案
```
src/app/api/
├── products/
│   └── route.ts (GET)
├── product-orders/
│   └── route.ts (GET, POST)
└── admin/
    ├── product-management/
    │   └── route.ts (GET, POST, PATCH, DELETE)
    ├── product-inventory/
    │   └── route.ts (GET, POST)
    └── product-orders/
        └── route.ts (GET, PATCH)
```

### 修改檔案
```
prisma/schema.prisma
├── 新增 ProductCategory enum
├── 新增 ProductOrderStatus enum
├── 新增 InventoryTransactionType enum
├── 新增 Product、ProductInventory、ProductOrder 等 7 個模型
└── 修改 User 與 Venue 關聯

src/components/site-nav.tsx
└── 新增「商城」選單項目

src/lib/types.ts
├── 新增 ProductCategory type
├── 新增 Product interface
└── 新增 ProductOrderDTO interface
```

---

## ✅ 檢查清單

### 前台
- [x] 右側選單新增商城
- [x] 商城頁面保留官網風格
- [x] 電腦版 4 欄商品卡片
- [x] 平板橫式 2-3 欄
- [x] 手機版單欄 + 下拉篩選
- [x] 商品圖片為 Placeholder（無擾視覺）
- [x] 商品資料集中管理（demo-products.ts）
- [x] DEMO 區塊清楚標記，可輕易移除

### 後台
- [x] 商品庫存獨立頁面 (/admin/products)
- [x] 客戶訂單獨立頁面 (/admin/product-orders)
- [x] 商品與商城管理獨立頁面 (/admin/product-management)
- [x] 左列表右明細模式（訂單頁面）
- [x] 商品價格由商品管理維護
- [x] 商品上架/下架由商品管理維護
- [x] 庫存管理獨立不混淆

### 資料流
- [x] 前台訂單自動建立
- [x] 訂單自動預留庫存
- [x] 標記出貨自動扣除庫存
- [x] 庫存異動記錄完整
- [x] 無影響其他頁面

### 程式碼品質
- [x] CSS Module 隔離樣式
- [x] 無修改全域 CSS
- [x] 無修改其他頁面
- [x] DEMO 資料清楚標記
- [x] 無遺漏的 import

---

## 🚀 下一步行動

### 優先級：高
1. **購物車系統整合** - 連接現有購物車，支援商品
2. **支付流程** - 連接 LINE Pay / 信用卡支付
3. **訂單確認** - 郵件/LINE 通知、收據生成

### 優先級：中
4. **商品編輯表單** - 詳細編輯頁面（表單、圖片上傳）
5. **庫存低庫存提醒** - 管理員通知系統
6. **出貨表單** - 出貨單、物流整合

### 優先級：低
7. **商品評論** - 評分與評論系統
8. **推薦商品** - 首頁推薦展示
9. **商品分析** - 銷售統計、熱銷商品

---

**實裝完成日期**: 2026-11-19  
**實裝者**: Claude Haiku 4.5  
**測試狀態**: 基礎功能驗證完成，待整合測試
