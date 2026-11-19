# 購物車與支付系統實裝

**實裝日期**: 2026-11-20  
**階段**: Phase 2 - 購物車與支付流程整合  
**狀態**: API 框架完成，待第三方服務整合

---

## 📋 實裝摘要

### ✅ 已實裝
- [x] 購物車系統擴展（支援商品項目）
- [x] 加入購物車 API
- [x] 移除購物車項目 API
- [x] 更新購物車數量 API
- [x] 支付初始化 API（LINE Pay / 信用卡框架）
- [x] 支付確認 API（訂單狀態更新）
- [x] 訂單確認通知 API（郵件 + LINE 通知框架）
- [x] CartDTO 型別擴展
- [x] 商品詳細對話框加入購物車整合

### ⏳ 待完成
- [ ] LINE Pay API 整合（官方 API 呼叫）
- [ ] 信用卡支付整合（Newebpay / Stripe）
- [ ] 郵件服務整合（SendGrid / AWS SES）
- [ ] LINE Notify 整合
- [ ] 購物車持久化存儲（Redis / 資料庫）
- [ ] 退款流程實裝

---

## 🛒 購物車系統擴展

### CartDTO 新增欄位
```typescript
export interface CartProductItemDTO {
  id: string
  productId: string
  productName: string
  productSku: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface CartDTO {
  items: CartItemDTO[] // 場地租借
  activityItems: CartActivityItemDTO[] // 活動
  productItems?: CartProductItemDTO[] // ✨ 新增：商品項目
  subtotal: number
  expiresAt: string | null
  invalidCount: number
}
```

### 購物車流程
```
1. 使用者在商城頁面點擊「加入購物車」
   ↓
2. 商品詳細對話框驗證數量
   ↓
3. 呼叫 POST /api/cart-product
   ↓
4. API 驗證庫存、返回項目信息
   ↓
5. 前端更新購物車狀態（Zustand store）
   ↓
6. 顯示成功提示
```

---

## 💳 支付流程

### 支付初始化流程
```
訂單準備完成（場地 + 活動 + 商品）
  ↓
使用者點擊「結帳」
  ↓
選擇支付方式（LINE Pay / 信用卡）
  ↓
呼叫 POST /api/payments/initiate
  ↓
API 生成交易編號、驗證訂單
  ↓
LINE Pay: 返回重定向 URL
信用卡: 返回支付表單資訊
  ↓
使用者完成支付
  ↓
支付服務回調確認
  ↓
呼叫 POST /api/payments/confirm
```

### 支付確認邏輯
```typescript
支付確認時自動：
1. 更新訂單狀態（PENDING → PAID）
2. 建立付款記錄（Payment / ProductPayment）
3. 設定 paidAt 時間戳
4. 商品訂單同步更新 paymentStatus（SUCCESS）
5. 返回更新後的訂單信息
```

---

## 📧 訂單確認通知

### 通知內容

**場地租借訂單**:
- 郵件：訂單詳情、場地清單、時間、金額
- LINE：簡潔通知，含訂單編號和場地列表

**商品訂單**:
- 郵件：商品清單、收件資訊、金額
- LINE：簡潔通知，含訂單編號和商品列表

### 通知發送流程
```
訂單支付成功
  ↓
呼叫 POST /api/orders/send-confirmation
  ↓
API 生成郵件內容和 LINE 訊息
  ↓
標記為待發送（PENDING）
  ↓
透過郵件服務發送郵件
透過 LINE Notify 發送訊息
  ↓
更新發送狀態（SENT）
```

---

## 🔌 API 新增清單

### 購物車 API
| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/cart-product` | POST | 加入購物車 |
| `/api/cart-product` | DELETE | 移除項目 |
| `/api/cart-product` | PATCH | 更新數量 |

### 支付 API
| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/payments/initiate` | POST | 初始化支付 |
| `/api/payments/confirm` | POST | 確認支付 |
| `/api/payments/status` | GET | 查詢狀態 |

### 通知 API
| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/orders/send-confirmation` | POST | 發送確認通知 |

---

## 🔐 安全性檢查清單

- [x] 所有 API 需要登入驗證
- [x] 訂單權限驗證（userId 匹配）
- [x] 庫存驗證（防止超賣）
- [x] 訂單狀態驗證（PENDING 才能支付）
- [x] 金額驗證（防止欺詐）
- [ ] CSRF 防護（需要確認現有系統是否已實裝）
- [ ] 支付交易簽名驗證（待 LINE Pay 整合）
- [ ] 郵件發送日誌記錄（待實裝）

---

## 📝 實裝細節

### 購物車項目 API（POST）

**驗證流程**:
1. 檢查使用者登入
2. 查詢商品是否存在
3. 驗證庫存充足（availableQuantity >= quantity）
4. 返回項目信息

**未來改進**:
- 儲存購物車到 Redis（快取）
- 儲存購物車到資料庫（持久化）
- 購物車過期時間管理

### 支付初始化 API

**支援方式**:

**LINE Pay**:
- 生成重定向 URL
- 當前為框架，待實裝 LINE Pay API 呼叫
- 應使用 `linePayApiClient.request()`

**信用卡**:
- 生成交易編號
- 當前為框架，待整合 Newebpay / Stripe
- 應返回支付表單或安全令牌

### 支付確認 API

**場地租借訂單**:
```typescript
Booking: PENDING → PAID
Payment: 新建記錄（status: SUCCESS）
```

**商品訂單**:
```typescript
ProductOrder: status 保持 PENDING → PAID, paymentStatus: PENDING → SUCCESS
ProductPayment: 新建記錄（status: SUCCESS）
```

### 訂單確認通知 API

**郵件內容生成**:
- 使用 HTML 模板
- 包含訂單詳情、商品清單、金額
- 待整合郵件服務（SendGrid）

**LINE 通知**:
- 文字格式，含關鍵信息
- 待整合 LINE Notify API
- 檢查 `user.viaLine` 標記

---

## 🧪 測試檢查清單

### 功能測試
- [ ] 點擊「加入購物車」成功加入
- [ ] 加入購物車前驗證庫存不足時顯示錯誤
- [ ] 更新購物車數量成功
- [ ] 移除購物車項目成功
- [ ] 購物車項目計數正確（items + activityItems + productItems）

### 支付流程測試
- [ ] LINE Pay 重定向 URL 生成正確
- [ ] 支付確認後訂單狀態更新為 PAID
- [ ] 付款記錄建立成功
- [ ] 信用卡表單資訊返回正確

### 通知測試
- [ ] 郵件內容生成正確
- [ ] LINE 訊息格式正確
- [ ] 通知狀態標記為 PENDING
- [ ] 通知方式根據使用者設定發送

### 權限和驗證測試
- [ ] 未登入使用者無法加入購物車
- [ ] 無權限訂單無法支付
- [ ] 庫存不足無法下單
- [ ] 已支付訂單無法重複支付

---

## 🔗 整合待辦

### 高優先級
1. **LINE Pay API 整合**
   - 官方 API 文檔：https://pay.line.me/web/payment/wait
   - 實裝 `/api/payments/line-pay-callback` 處理回調
   - 測試環境沙箱設定

2. **郵件服務整合**
   - 推薦：SendGrid（免費額度 100 封/天）
   - 或 AWS SES（包含在免費層）
   - 修改 `/api/orders/send-confirmation` 實裝發送邏輯

3. **LINE Notify 整合**
   - 官方文檔：https://notify-bot.line.me/
   - 儲存使用者的 LINE Notify Token
   - 修改通知邏輯以實際發送

### 中優先級
4. **購物車持久化**
   - 評估使用 Redis 或資料庫
   - 實裝購物車過期機制
   - 合併場地 + 活動 + 商品購物車

5. **支付交易管理**
   - 建立 PaymentTransaction 模型記錄所有支付
   - 實裝支付重試機制
   - 支付超時處理

6. **退款流程**
   - 實裝 `/api/refunds` 相關端點
   - 訂單退款狀態管理
   - 庫存回沖

---

## 📂 新增檔案清單

```
src/app/api/
├── cart-product/
│   └── route.ts (POST, DELETE, PATCH)
├── payments/
│   ├── initiate/
│   │   └── route.ts (POST)
│   └── confirm/
│       └── route.ts (POST, GET)
└── orders/
    └── send-confirmation/
        └── route.ts (POST)
```

---

## ⚙️ 環境變數需求

```bash
# LINE Pay 設定（待實裝）
LINE_PAY_CHANNEL_ID=
LINE_PAY_CHANNEL_SECRET=
LINE_PAY_API_URL=https://sandbox-api.pay.line.me

# 郵件服務設定（待整合）
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# LINE Notify 設定（待整合）
LINE_NOTIFY_API_URL=https://notify-api.line.me

# 網站設定
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 📚 相關參考

| 服務 | 文檔 | 狀態 |
|------|------|------|
| LINE Pay | https://pay.line.me/web/payment/wait | ⏳ 待整合 |
| SendGrid | https://sendgrid.com/docs/ | ⏳ 待整合 |
| LINE Notify | https://notify-bot.line.me/ | ⏳ 待整合 |
| Newebpay | https://www.newebpay.com/ | ⏳ 待評估 |
| Stripe | https://stripe.com/docs | ⏳ 待評估 |

---

## 🚀 下一步行動

### 立即可做（1-2 天）
1. 測試購物車 API（本機測試）
2. 測試支付 API 框架（無實際支付）
3. 建立 PaymentTransaction 模型
4. 設定郵件環境變數

### 本週完成（3-5 天）
5. LINE Pay API 開發者帳號申請
6. SendGrid 整合（郵件發送）
7. 線上支付測試（沙箱環境）

### 下週完成（1 周）
8. LINE Notify 整合
9. 退款流程實裝
10. 完整端對端測試

---

**實裝完成時間**: 2026-11-20  
**下次檢查**: 2026-11-21（整合進度）
