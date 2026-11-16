# 後台側欄導航重構 — Phase 1 架構分析報告

**報告日期**: 2026-11-16  
**項目狀態**: Phase 1 調查完成  
**分析範圍**: 左側邊欄導航結構與路由映射  

---

## 📋 Executive Summary

本報告詳細記錄了後台導航重構的架構分析。計劃將「訂單與財務」(9 個子選單) 和「會員與活動」(10 個子選單) 的分散頁面整合為兩個主頁面，每個頁面內使用標籤 (tabs) 組織功能。其餘 16 個左側菜單項目將保持完全不變。

---

## 🎯 重構目標

### ✅ 目標功能
- ✅ 減少視覺複雜度：從側欄的 19 個分散子選單降至 2 個主頁面 + 內部標籤
- ✅ 保持功能完整：所有現有功能保留，無損失或簡化
- ✅ 向後相容：所有當前網址繼續可用（通過重定向或 query 參數）
- ✅ 保護不可修改的區域：16 個其他側菜單項目零改動

### 🔒 不可修改的 16 個左側菜單模塊

以下模塊 **完全不可修改** 其任何功能或名稱：

```
頂層導航分類：
├─ 首頁 (/admin)
├─ 場地與預約 (/admin/schedule, /admin/courts, /admin/maintenance)
├─ 即時監控 (/admin/monitor + tabs)
├─ 智慧設備管理 (/admin/devices, /admin/control)
├─ 門禁權限管理 (/admin/access)
├─ [訂單與財務] — 待重構 ⚠️
├─ [會員與活動] — 待重構 ⚠️
├─ 營運總覽 (/admin/reports 及子頁面)
├─ 系統設定
│  ├─ 球館基本資料 (/admin/settings)
│  ├─ 定價與會員折扣 (/admin/pricing)
│  ├─ 儲值方案 (/admin/settings/topup)
│  ├─ 金流與發票設定 (/admin/settings/payments)
│  ├─ 設備串接 (/admin/settings/devices)
│  ├─ 後台帳號與權限 (/admin/settings/staff)
│  └─ 操作紀錄 (/admin/audit)
```

**重要業務規則（不可改動）**:
- VIP 是會員等級，不是後台權限角色
- 黑名單是會員帳戶狀態（受限制），不改變角色

---

## 📁 現有代碼結構分析

### 主要檔案位置

#### 1. 導航配置文件
```
src/app/admin/admin-nav.ts — 主導航配置
  └─ 包含：ADMIN_NAV 陣列、activeHref()、sectionLabel()
  └─ 導出類型：AdminNavItem、AdminNavGroup、AdminNavIcon
```

#### 2. 側邊欄組件
```
src/components/admin/admin-shell.tsx — 後台外殼與側邊欄
  └─ AdminShell — 頂層容器
  └─ SidebarNav — 側邊欄導航渲染
  └─ NAV_ICON — 圖標映射
```

#### 3. 佈局文件
```
src/app/admin/layout.tsx — 後台根布局
  └─ 伺服器端認證檢查
  └─ 傳遞用戶權限到 AdminShell
```

#### 4. 測試檔案
```
src/__tests__/admin-nav.test.ts — 導航測試（現存）
```

---

## 🗂️ 需要重構的分類詳細分析

### 1️⃣ 訂單與財務 (orders)

**現有結構** (`admin-nav.ts` 第 69-83 行):
```
key: 'orders'
label: '訂單與財務'
icon: 'orders'
items: [
  訂場與活動訂單 → /admin/bookings (exact: true)
  收款紀錄 → /admin/finance/payments
  退款紀錄 → /admin/refunds
  儲值交易 → /admin/topup
  點數與票券交易 → /admin/members/points
  發票管理 → /admin/invoices
  費用與收據審核 → /admin/expenses
  日結與對帳 → /admin/finance/daily
  商品訂單 → /admin/bookings/products (notOpen: true)
]
```

**相關頁面路由**:
```
/admin/bookings/page.tsx — 訂場與活動訂單（主交易管理）
/admin/finance/page.tsx — 收入與退款分析
/admin/finance/payments/page.tsx — 收款紀錄（詳情視圖）
/admin/refunds/page.tsx — 退款紀錄
/admin/topup/page.tsx — 儲值交易
/admin/members/points/page.tsx — 點數與票券交易
/admin/invoices/page.tsx — 發票管理
/admin/expenses/page.tsx — 費用與收據審核
/admin/finance/daily/page.tsx — 日結與對帳
/admin/bookings/products/page.tsx — 商品訂單 (notOpen)
```

**重構建議方案**:

**主頁面**: `/admin/finance` (重新定義為「訂單與財務」主頁面)
**內部標籤**:
```
Tab 1: 訂場與活動訂單 (當前 /admin/bookings 的內容)
Tab 2: 收款紀錄 (當前 /admin/finance/payments 的內容)
Tab 3: 退款紀錄 (當前 /admin/refunds 的內容)
Tab 4: 儲值交易 (當前 /admin/topup 的內容)
Tab 5: 點數與票券交易 (當前 /admin/members/points 的內容)
Tab 6: 發票管理 (當前 /admin/invoices 的內容)
Tab 7: 費用與收據審核 (當前 /admin/expenses 的內容)
Tab 8: 日結與對帳 (當前 /admin/finance/daily 的內容)
Tab 9: 商品訂單 (當前 /admin/bookings/products 的內容，notOpen)
```

**向後相容性策略**:
```
/admin/bookings → 重定向到 /admin/finance?tab=bookings
/admin/finance/payments → 重定向到 /admin/finance?tab=payments
/admin/refunds → 重定向到 /admin/finance?tab=refunds
/admin/topup → 重定向到 /admin/finance?tab=topup
/admin/members/points → 重定向到 /admin/finance?tab=points
/admin/invoices → 重定向到 /admin/finance?tab=invoices
/admin/expenses → 重定向到 /admin/finance?tab=expenses
/admin/finance/daily → 重定向到 /admin/finance?tab=daily
/admin/bookings/products → 重定向到 /admin/finance?tab=products

主頁面 /admin/finance/page.tsx：
  ✓ 檢查 ?tab 查詢參數
  ✓ 預設 tab = 'bookings'
  ✓ 根據標籤加載對應的內容組件
  ✓ 保持 tab 在頁面刷新時持久化
  ✓ 保持 tab 在瀏覽器返回/前進按鈕中
```

---

### 2️⃣ 會員與活動 (members)

**現有結構** (`admin-nav.ts` 第 84-100 行):
```
key: 'members'
label: '會員與活動'
icon: 'members'
items: [
  人員列表 → /admin/members (exact: true)
  會員預約與消費紀錄 → /admin/members/history
  黑名單 → /admin/members?tab=blacklist
  活動列表 → /admin/activities
  場次與週期安排 → /admin/sessions
  報名與候補/通知名單 → /admin/registrations
  教練 → /admin/events
  優惠與票券方案 → /admin/marketing/vouchers
  商品與庫存 → /admin/marketing/products (notOpen: true)
  行銷活動與通知 → /admin/marketing/campaigns (notOpen: true)
]
```

**相關頁面路由**:
```
/admin/members/page.tsx — 人員管理（已有 tabs: all/coaches/staff/blacklist）
/admin/members/history/page.tsx — 會員預約與消費紀錄
/admin/activities/page.tsx — 活動列表
/admin/sessions/page.tsx — 場次與週期安排
/admin/registrations/page.tsx — 報名與候補
/admin/events/page.tsx — 教練
/admin/marketing/vouchers/page.tsx — 優惠與票券方案
/admin/marketing/products/page.tsx — 商品與庫存 (notOpen)
/admin/marketing/campaigns/page.tsx — 行銷活動與通知 (notOpen)
```

**⚠️ 特殊情況**:
- `/admin/members/page.tsx` 已經有內部標籤系統（all/coaches/staff/blacklist）
- 需要將該標籤系統與新的外部標籤架構協調

**重構建議方案**:

**主頁面**: `/admin/members` (保持不變，擴展為「會員與活動」主頁面)
**內部標籤組**:
```
Tab Group 1: 會員相關
  ├─ Tab 1A: 人員列表 (current /admin/members)
  │   ├─ 子標籤: 全部會員 | 教練 | 工作人員 | 黑名單
  ├─ Tab 1B: 會員預約與消費紀錄 (current /admin/members/history)
  ├─ Tab 1C: 黑名單 (current /admin/members?tab=blacklist)

Tab Group 2: 活動相關
  ├─ Tab 2A: 活動列表 (current /admin/activities)
  ├─ Tab 2B: 場次與週期安排 (current /admin/sessions)
  ├─ Tab 2C: 報名與候補/通知名單 (current /admin/registrations)
  ├─ Tab 2D: 教練 (current /admin/events)

Tab Group 3: 行銷相關
  ├─ Tab 3A: 優惠與票券方案 (current /admin/marketing/vouchers)
  ├─ Tab 3B: 商品與庫存 (current /admin/marketing/products, notOpen)
  ├─ Tab 3C: 行銷活動與通知 (current /admin/marketing/campaigns, notOpen)
```

**向後相容性策略**:
```
/admin/members (基礎) → 保持 /admin/members?tab=people（預設）
/admin/members?tab=blacklist → 保持運作（内部標籤）
/admin/members/history → 重定向到 /admin/members?tab=history
/admin/activities → 重定向到 /admin/members?tab=activities
/admin/sessions → 重定向到 /admin/members?tab=sessions
/admin/registrations → 重定向到 /admin/members?tab=registrations
/admin/events → 重定向到 /admin/members?tab=events
/admin/marketing/vouchers → 重定向到 /admin/members?tab=vouchers
/admin/marketing/products → 重定向到 /admin/members?tab=products
/admin/marketing/campaigns → 重定向到 /admin/members?tab=campaigns

實現方式（建議）:
  ✓ 複雜度：可能需要嵌套標籤（主標籤 + 子標籤）
  ✓ 或者：使用單一標籤系統，但面板內部可有次級導航
```

---

## 📝 現有導航邏輯分析

### activeHref() 函數 (`admin-nav.ts` 第 144-159 行)

**功能**: 根據當前路由判斷應該選中哪個導航項
```typescript
export function activeHref(pathname: string, search: string = ''): string | null {
  // 1. 檢查 ALIAS_PATHS (相關但不在側欄的頁面)
  // 2. 匹配路由路徑（最長匹配優先）
  // 3. 支持查詢參數匹配（如 ?tab=）
}
```

**現有別名** (`admin-nav.ts` 第 131-138 行):
```
/admin/receipts → /admin/expenses
/admin/ai-courts → /admin/control
/admin/ai-assistant → /admin
/admin/templates → /admin/activities
/admin/incidents → /admin/monitor?tab=events
/admin/automation → /admin/devices (V8.1)
```

**重構影響**: 需要添加新別名以支持所有舊 URL 到新標籤 URL 的映射

### 權限檢查 (`admin-shell.tsx` 第 151-154 行)

**邏輯**:
```typescript
const allowed = (p?: Permission) => !p || user.permissions.includes(p)
const groups = ADMIN_NAV
  .map(g => ({ ...g, items: g.items?.filter(i => allowed(i.permission)) }))
  .filter(g => g.href ? allowed(g.permission) : (g.items?.length ?? 0) > 0)
```

**重構影響**: 
- 標籤內容需要相同的權限檢查機制
- 某些標籤可能因權限被隱藏，而不是整個分組

---

## 🔧 需要修改的文件清單

### 必須修改

#### 1. **src/app/admin/admin-nav.ts** ⚠️ 關鍵

**修改內容**:
- 修改 `ADMIN_NAV` 中的 `orders` 分組：改為直接連結到 `/admin/finance`
- 修改 `ADMIN_NAV` 中的 `members` 分組：改為直接連結到 `/admin/members`
- 擴展 `ALIAS_PATHS` 以支持所有舊 URL 的重定向
- **行數變化**: 增加 ~20-30 行（新別名）

#### 2. **src/components/admin/admin-shell.tsx** ⚠️ 可能修改

**修改內容** (待定):
- 如果需要在側邊欄顯示活動標籤指示，可能需要擴展邏輯
- 當前設計應該自動支持直接連結，無需改動

#### 3. **src/app/admin/bookings/page.tsx** → **轉移內容**

**修改內容**:
- 抽取內容為標籤式組件
- 整合到新的 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 4. **src/app/admin/finance/page.tsx** ⚠️ 重寫

**修改內容**:
- 改為新的訂單與財務主頁面
- 實現標籤導航邏輯
- 根據 `?tab` 參數加載對應內容
- **新增**: 150-300 行

#### 5. **src/app/admin/members/page.tsx** ⚠️ 擴展

**修改內容**:
- 擴展現有標籤系統以支持新的分類
- 添加新標籤：history、activities、sessions、等等
- 可能需要重新組織頁面結構以支持更多標籤

#### 6. **src/app/admin/refunds/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 7. **src/app/admin/topup/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 8. **src/app/admin/members/history/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 9. **src/app/admin/activities/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 10. **src/app/admin/sessions/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 11. **src/app/admin/registrations/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 12. **src/app/admin/events/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 13. **src/app/admin/finance/payments/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 14. **src/app/admin/invoices/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 15. **src/app/admin/expenses/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 16. **src/app/admin/members/points/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 17. **src/app/admin/finance/daily/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 18. **src/app/admin/bookings/products/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/finance/page.tsx`
- 原頁面改為重定向

#### 19. **src/app/admin/marketing/vouchers/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 20. **src/app/admin/marketing/products/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 21. **src/app/admin/marketing/campaigns/page.tsx** → **轉移內容**

**修改內容**:
- 抽取為標籤式組件
- 整合到 `/admin/members/page.tsx`
- 原頁面改為重定向

#### 22. **src/__tests__/admin-nav.test.ts** ⚠️ 需要更新

**修改內容**:
- 更新測試以適應新的導航結構
- 驗證別名映射的正確性
- 測試標籤導航的運作

---

### 不得修改（16 個受保護的菜單）

以下檔案組及其功能 **完全不得修改**:

#### 首頁和基本導航
```
✅ src/app/admin/page.tsx — 首頁
✅ src/components/admin/admin-shell.tsx — 側欄核心邏輯（只能進行最小改動）
```

#### 場地與預約
```
✅ src/app/admin/schedule/page.tsx
✅ src/app/admin/courts/page.tsx
✅ src/app/admin/maintenance/page.tsx
```

#### 即時監控
```
✅ src/app/admin/monitor/page.tsx
```

#### 智慧設備管理
```
✅ src/app/admin/devices/page.tsx
✅ src/app/admin/control/page.tsx
```

#### 門禁權限管理
```
✅ src/app/admin/access/page.tsx
```

#### 營運總覽
```
✅ src/app/admin/reports/page.tsx
✅ src/app/admin/reports/utilization/page.tsx
✅ src/app/admin/reports/activities/page.tsx
✅ src/app/admin/reports/members/page.tsx
```

#### 系統設定
```
✅ src/app/admin/settings/page.tsx
✅ src/app/admin/pricing/page.tsx
✅ src/app/admin/settings/site/page.tsx
✅ src/app/admin/settings/topup/page.tsx
✅ src/app/admin/settings/payments/page.tsx
✅ src/app/admin/settings/devices/page.tsx
✅ src/app/admin/settings/staff/page.tsx
✅ src/app/admin/audit/page.tsx
```

#### 即時監控和營運頁面的客戶端組件
```
✅ src/app/admin/finance/finance-client.tsx
✅ src/app/admin/bookings/transactions-client.tsx
✅ 所有其他客戶端組件保持不變
```

---

## 🔀 重定向方案詳細說明

### 方案 A: Next.js 重定向（推薦）

在 `next.config.js` 或 middleware 中配置：

```typescript
redirects: async () => [
  { source: '/admin/bookings', destination: '/admin/finance?tab=bookings', permanent: false },
  { source: '/admin/finance/payments', destination: '/admin/finance?tab=payments', permanent: false },
  { source: '/admin/refunds', destination: '/admin/finance?tab=refunds', permanent: false },
  { source: '/admin/topup', destination: '/admin/finance?tab=topup', permanent: false },
  { source: '/admin/members/points', destination: '/admin/finance?tab=points', permanent: false },
  { source: '/admin/invoices', destination: '/admin/finance?tab=invoices', permanent: false },
  { source: '/admin/expenses', destination: '/admin/finance?tab=expenses', permanent: false },
  { source: '/admin/finance/daily', destination: '/admin/finance?tab=daily', permanent: false },
  { source: '/admin/bookings/products', destination: '/admin/finance?tab=products', permanent: false },
  
  { source: '/admin/members/history', destination: '/admin/members?tab=history', permanent: false },
  { source: '/admin/activities', destination: '/admin/members?tab=activities', permanent: false },
  { source: '/admin/sessions', destination: '/admin/members?tab=sessions', permanent: false },
  { source: '/admin/registrations', destination: '/admin/members?tab=registrations', permanent: false },
  { source: '/admin/events', destination: '/admin/members?tab=events', permanent: false },
  { source: '/admin/marketing/vouchers', destination: '/admin/members?tab=vouchers', permanent: false },
  { source: '/admin/marketing/products', destination: '/admin/members?tab=products', permanent: false },
  { source: '/admin/marketing/campaigns', destination: '/admin/members?tab=campaigns', permanent: false },
]
```

**優點**:
- 所有重定向在構建時生成
- 性能最好
- 瀏覽器歷史正確

**缺點**:
- 需要修改 Next.js 配置
- 靜態配置不夠靈活

### 方案 B: 動態路由重定向

在每個原頁面中添加重定向邏輯（使用 `redirect()` 或 `useRouter`）：

```typescript
// src/app/admin/bookings/page.tsx
import { redirect } from 'next/navigation'

export default function BookingsRedirect() {
  redirect('/admin/finance?tab=bookings')
}
```

**優點**:
- 簡單直接
- 不需要修改 Next.js 配置
- 可以保留原頁面以備回滾

**缺點**:
- 需要創建大量重定向頁面
- 浪費一些請求週期

### 推薦方案

**階段 1**: 使用方案 B（動態重定向頁面）
- 保留原頁面結構以備回滾
- 在重構過程中易於調試

**階段 2**: 遷移到方案 A（Next.js 重定向）
- 一旦重構穩定，改用 Next.js 配置
- 提高性能

---

## 🗺️ 標籤導航實現方案

### 訂單與財務標籤 (9 個)

**實現位置**: `src/app/admin/finance/page.tsx`

**標籤定義**:
```typescript
const FINANCE_TABS = [
  { id: 'bookings', label: '訂場與活動訂單', permission: 'bookings' },
  { id: 'payments', label: '收款紀錄', permission: 'finance' },
  { id: 'refunds', label: '退款紀錄', permission: 'finance' },
  { id: 'topup', label: '儲值交易', permission: 'finance' },
  { id: 'points', label: '點數與票券交易', permission: 'members' },
  { id: 'invoices', label: '發票管理', permission: 'invoice' },
  { id: 'expenses', label: '費用與收據審核', permission: 'expenses.own' },
  { id: 'daily', label: '日結與對帳', permission: 'finance' },
  { id: 'products', label: '商品訂單', permission: 'marketing', notOpen: true },
]
```

**內容組件**:
```
src/app/admin/finance/
  ├─ page.tsx — 主頁面（標籤容器）
  ├─ bookings-tab.tsx — 訂場與活動訂單（from bookings/)
  ├─ payments-tab.tsx — 收款紀錄（from finance/payments/)
  ├─ refunds-tab.tsx — 退款紀錄（from refunds/)
  ├─ topup-tab.tsx — 儲值交易（from topup/)
  ├─ points-tab.tsx — 點數與票券交易（from members/points/)
  ├─ invoices-tab.tsx — 發票管理（from invoices/)
  ├─ expenses-tab.tsx — 費用與收據審核（from expenses/)
  ├─ daily-tab.tsx — 日結與對帳（from finance/daily/)
  └─ products-tab.tsx — 商品訂單（from bookings/products/)
```

### 會員與活動標籤 (10 個 + 嵌套)

**實現位置**: `src/app/admin/members/page.tsx`

**擴展現有標籤系統**:

```typescript
// 現有子標籤（保留）
const PEOPLE_TABS = [
  { id: 'all', label: '全部會員' },
  { id: 'coaches', label: '教練' },
  { id: 'staff', label: '工作人員與管理員' },
  { id: 'blacklist', label: '黑名單' },
]

// 新的主標籤（擴展）
const MEMBERS_MAIN_TABS = [
  { id: 'people', label: '人員管理', subtabs: PEOPLE_TABS },
  { id: 'history', label: '會員預約與消費紀錄' },
  { id: 'activities', label: '活動列表' },
  { id: 'sessions', label: '場次與週期安排' },
  { id: 'registrations', label: '報名與候補/通知名單' },
  { id: 'events', label: '教練' },
  { id: 'vouchers', label: '優惠與票券方案' },
  { id: 'products', label: '商品與庫存', notOpen: true },
  { id: 'campaigns', label: '行銷活動與通知', notOpen: true },
]
```

**內容組件** (可能的結構):
```
src/app/admin/members/
  ├─ page.tsx — 主頁面（標籤容器）
  ├─ (tabs)/
  │  ├─ people-tab.tsx — 人員管理（現有邏輯）
  │  ├─ history-tab.tsx — 會員預約與消費紀錄（from members/history/)
  │  ├─ activities-tab.tsx — 活動列表（from activities/)
  │  ├─ sessions-tab.tsx — 場次與週期安排（from sessions/)
  │  ├─ registrations-tab.tsx — 報名與候補（from registrations/)
  │  ├─ events-tab.tsx — 教練（from events/)
  │  ├─ vouchers-tab.tsx — 優惠與票券方案（from marketing/vouchers/)
  │  ├─ products-tab.tsx — 商品與庫存（from marketing/products/)
  │  └─ campaigns-tab.tsx — 行銷活動與通知（from marketing/campaigns/)
  └─ history/ → 重定向到 /admin/members?tab=history
```

---

## 🔗 URL 相容性映射完整表

### 訂單與財務 (finance)

| 原 URL | 新 URL | 重定向方法 |
|--------|--------|----------|
| `/admin/bookings` | `/admin/finance?tab=bookings` | 頁面重定向 |
| `/admin/finance/payments` | `/admin/finance?tab=payments` | 頁面重定向 |
| `/admin/refunds` | `/admin/finance?tab=refunds` | 頁面重定向 |
| `/admin/topup` | `/admin/finance?tab=topup` | 頁面重定向 |
| `/admin/members/points` | `/admin/finance?tab=points` | 頁面重定向 |
| `/admin/invoices` | `/admin/finance?tab=invoices` | 頁面重定向 |
| `/admin/expenses` | `/admin/finance?tab=expenses` | 頁面重定向 |
| `/admin/finance/daily` | `/admin/finance?tab=daily` | 頁面重定向 |
| `/admin/bookings/products` | `/admin/finance?tab=products` | 頁面重定向 |
| `/admin/finance` (原主頁) | `/admin/finance?tab=payments` | 改為新的主頁面 |

### 會員與活動 (members)

| 原 URL | 新 URL | 重定向方法 |
|--------|--------|----------|
| `/admin/members` (原) | `/admin/members?tab=people` | 改為新的主頁面 |
| `/admin/members?tab=blacklist` (原) | `/admin/members?tab=people&subtab=blacklist` | 支持嵌套 |
| `/admin/members/history` | `/admin/members?tab=history` | 頁面重定向 |
| `/admin/activities` | `/admin/members?tab=activities` | 頁面重定向 |
| `/admin/sessions` | `/admin/members?tab=sessions` | 頁面重定向 |
| `/admin/registrations` | `/admin/members?tab=registrations` | 頁面重定向 |
| `/admin/events` | `/admin/members?tab=events` | 頁面重定向 |
| `/admin/marketing/vouchers` | `/admin/members?tab=vouchers` | 頁面重定向 |
| `/admin/marketing/products` | `/admin/members?tab=products` | 頁面重定向 |
| `/admin/marketing/campaigns` | `/admin/members?tab=campaigns` | 頁面重定向 |

---

## ⚠️ 潛在衝突與解決方案

### 衝突 1: `/admin/members/points` 路由衝突

**問題**: `/admin/members/points` 是「點數與票券交易」但路由在 `members/` 下

**當前狀況**:
```
/admin/members/page.tsx — 人員管理頁面
/admin/members/[id]/page.tsx — 會員詳情頁面
/admin/members/points/page.tsx — 點數與票券交易（新加）
/admin/members/history/page.tsx — 會員預約與消費紀錄
/admin/members/restrictions/page.tsx — 黑名單限制（輔助）
```

**解決方案**: 
- 將 `/admin/members/points/page.tsx` 改為重定向到 `/admin/finance?tab=points`
- 確保 `[id]` 動態路由不會捕獲 `points` 和 `history` 路由
- Next.js 路由優先級應該是: 具體路由 > 動態路由 ✅

### 衝突 2: 嵌套標籤複雜性

**問題**: 會員與活動有「人員管理」的子標籤，如何與主標籤協調？

**當前狀況**:
```
/admin/members?tab=all — 全部會員
/admin/members?tab=coaches — 教練
/admin/members?tab=staff — 工作人員
/admin/members?tab=blacklist — 黑名單
```

**解決方案** (選項):

**選項 A**: 保持嵌套結構
```
主標籤: ?tab=people
子標籤: &subtab=all|coaches|staff|blacklist
例: /admin/members?tab=people&subtab=blacklist
```

**選項 B**: 展平所有標籤
```
/admin/members?tab=people-all — 全部會員
/admin/members?tab=people-coaches — 教練
/admin/members?tab=people-staff — 工作人員
/admin/members?tab=people-blacklist — 黑名單
/admin/members?tab=history — 會員預約與消費紀錄
/admin/members?tab=activities — 活動列表
... etc
```

**選項 C**: 在 `people` 標籤內保留子標籤
```
主標籤 UI: [人員管理] [會員預約與消費紀錄] [活動列表] ...
當打開「人員管理」時，內部顯示: [全部] [教練] [工作人員] [黑名單]

URL: /admin/members?tab=people (默認 people-all)
```

**推薦**: 選項 C（保持向後相容，視覺清晰）

### 衝突 3: 權限與可見性

**問題**: 某些標籤可能因權限而隱藏，影響標籤導航

**例**:
- 用戶只有 `bookings` 權限，但 `finance` 組有多個需要 `finance` 權限的標籤
- 應該顯示整個分組還是只顯示有權限的標籤？

**解決方案**:
- 保留 `orders` 和 `members` 分組在側欄
- 如果用戶沒有任何子標籤的權限，隱藏整個分組
- 進入已授權的標籤頁面時，隱藏無權限的其他標籤

---

## 📊 影響範圍摘要

### 側邊欄變更前後對比

**變更前** (19 個子選單):
```
訂單與財務 (9 個)
├─ 訂場與活動訂單
├─ 收款紀錄
├─ 退款紀錄
├─ 儲值交易
├─ 點數與票券交易
├─ 發票管理
├─ 費用與收據審核
├─ 日結與對帳
└─ 商品訂單

會員與活動 (10 個)
├─ 人員列表
├─ 會員預約與消費紀錄
├─ 黑名單
├─ 活動列表
├─ 場次與週期安排
├─ 報名與候補/通知名單
├─ 教練
├─ 優惠與票券方案
├─ 商品與庫存
└─ 行銷活動與通知
```

**變更後** (2 個主菜單 + 內部標籤):
```
訂單與財務 (標籤容器)
  [訂場與活動訂單] [收款紀錄] [退款紀錄] [儲值交易] [點數與票券] [發票] [費用] [日結] [商品]

會員與活動 (標籤容器)
  [人員管理] [會員消費] [黑名單] [活動列表] [場次] [報名] [教練] [優惠] [商品] [行銷]
```

### 文件變更統計

| 分類 | 數量 | 說明 |
|------|------|------|
| 修改主文件 | 4 | `admin-nav.ts`, `finance/page.tsx`, `members/page.tsx`, 測試 |
| 轉移為標籤組件 | 9 | 訂單與財務子頁面 |
| 轉移為標籤組件 | 10 | 會員與活動子頁面 |
| 改為重定向 | 19 | 原頁面重定向到新標籤 URL |
| 新增別名 | ~20 | `ALIAS_PATHS` 中的重定向映射 |
| **總計變動** | **~62** | 增刪改文件 |

### 代碼行數估算

| 項目 | 估算行數 |
|------|---------|
| `admin-nav.ts` 修改 | +20 行 |
| `finance/page.tsx` 新建 | +200-300 行 |
| `finance/*-tab.tsx` 組件抽取 | 無淨增（移動現有代碼） |
| `members/page.tsx` 擴展 | +100-150 行 |
| `members/*-tab.tsx` 組件抽取 | 無淨增（移動現有代碼） |
| 重定向頁面 | 19 × 10 行 = +190 行 |
| 測試更新 | +50-100 行 |
| **總計淨增** | **~600-800 行** |

---

## ✅ Phase 1 完成檢查清單

### 架構分析

- ✅ 識別導航結構 (`admin-nav.ts`)
- ✅ 識別側邊欄組件 (`admin-shell.tsx`)
- ✅ 映射所有受影響的頁面路由
- ✅ 列出 16 個受保護的菜單項
- ✅ 分析權限檢查邏輯
- ✅ 識別現有的別名系統

### 重構方案

- ✅ 訂單與財務標籤定義 (9 個)
- ✅ 會員與活動標籤定義 (10 個)
- ✅ URL 相容性映射表
- ✅ 重定向方案評估
- ✅ 嵌套標籤解決方案

### 文件清單

- ✅ 22 個必須修改的文件
- ✅ 16 個不得修改的受保護文件
- ✅ 潛在衝突識別與解決方案

### 風險評估

- ✅ 衝突 1: 路由優先級 → 無風險 (Next.js 優先級清晰)
- ✅ 衝突 2: 嵌套標籤 → 選項 C (保持相容)
- ✅ 衝突 3: 權限可見性 → 標籤級權限檢查

---

## 🚀 Phase 2 建議清單

### 實施步驟順序

1. **Step 1**: 更新 `admin-nav.ts`
   - 修改 `ADMIN_NAV` 結構
   - 擴展 `ALIAS_PATHS`
   - 預計耗時: 30 分鐘

2. **Step 2**: 創建 `finance/page.tsx` 主頁面
   - 實現標籤導航邏輯
   - 實現 query 參數持久化
   - 預計耗時: 1 小時

3. **Step 3**: 抽取訂單與財務子頁面為標籤組件
   - 從 `bookings/`, `refunds/`, `topup/` 等抽取內容
   - 創建 `finance/*-tab.tsx` 組件
   - 預計耗時: 2 小時

4. **Step 4**: 更新原頁面為重定向
   - `/admin/bookings/page.tsx` → 重定向
   - `/admin/refunds/page.tsx` → 重定向
   - ... 等 9 個文件
   - 預計耗時: 30 分鐘

5. **Step 5**: 擴展 `members/page.tsx`
   - 添加新的主標籤
   - 保持人員管理的子標籤
   - 預計耗時: 1.5 小時

6. **Step 6**: 抽取會員與活動子頁面為標籤組件
   - 從 `activities/`, `sessions/`, `events/` 等抽取
   - 創建 `members/*-tab.tsx` 組件
   - 預計耗時: 2 小時

7. **Step 7**: 更新會員與活動原頁面為重定向
   - `/admin/activities/page.tsx` → 重定向
   - `/admin/sessions/page.tsx` → 重定向
   - ... 等 8 個文件
   - 預計耗時: 30 分鐘

8. **Step 8**: 測試與驗證
   - 測試所有 URL 重定向
   - 測試權限篩選
   - 測試標籤導航
   - 預計耗時: 2 小時

9. **Step 9**: 更新測試
   - 更新 `admin-nav.test.ts`
   - 預計耗時: 1 小時

### 總估算

**總耗時**: 約 10-12 小時（1-2 個工作天）

---

## 📋 業務規則驗證

### ✅ 已驗證的業務規則

1. **VIP 是會員等級，不是後台權限角色**
   - 不影響重構（VIP 在前台 schema 中，不在後台權限系統中）

2. **黑名單是會員帳戶狀態**
   - 當前已經作為 `members` 頁面的標籤存在
   - 重構後保持作為 `members?tab=people&subtab=blacklist`

3. **所有當前網址都必須繼續可以使用**
   - ✅ 通過完整的 URL 重定向映射確保

---

## 📝 后续建议

### 立即执行（Phase 2）
1. 获得产品设计和技术团队的批准
2. 创建功能分支用于实现
3. 按建议的步骤顺序执行变更

### 长期考虑
1. 考虑是否将其他大型菜单项也进行标签化处理
2. 考虑是否统一标签导航的 UI 组件
3. 考虑是否需要保存标签导航状态到用户偏好

---

## 🎯 结论

Phase 1 分析已完成。该方案满足所有需求：

✅ **减少视觉复杂度** — 从 19 个分散子菜单降至 2 个主菜单 + 内部标签  
✅ **保持功能完整** — 所有功能保留，无损失  
✅ **向后兼容** — 所有 URL 通过重定向继续可用  
✅ **保护受限区域** — 16 个其他菜单项零改动  
✅ **清晰的实施路径** — 分为 9 个明确的步骤  

**建议下一步**: 获得批准后进入 Phase 2 - 实施阶段。

---

**分析人员**: Claude Haiku 4.5  
**分析日期**: 2026-11-16  
**Phase 状态**: ✅ 完成  
**预计 Phase 2 开始**: 经批准后立即开始  
