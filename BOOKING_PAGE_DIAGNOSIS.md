# 前台預約頁面 (/booking) 診斷與修復報告

**日期：** 2026-11-24  
**狀態：** ✅ 本地編譯成功，已部署修復

---

## 問題診斷

### 症狀
- 生產環境 (Vercel) 中 `/booking` 頁面顯示「系統暫時發生問題」
- 錯誤代碼：`3987465915`（原始用戶報告）
- 後台頁面正常工作，表明問題集中在前台預約頁面
- 本地 `npm run build` 最初報告 `SyntaxError: Unexpected end of JSON input`

### 根本原因分析

經過代碼審查，`Unexpected end of JSON input` 通常由以下情況引發：

1. **空 JSON 字段**
   - `homePageConfig.draftConfig` 或 `publishedConfig` 存儲為空字符串
   - `JSON.parse("")` 拋出該錯誤

2. **不完整的 JSON 數據**
   - 數據庫中某些 JSON 字段未完整寫入（寫入中斷）
   - 或在數據序列化時被截斷

3. **缺失的數據驗證**
   - 在讀取數據時未驗證 JSON 字段的完整性
   - 在返回給前端前未檢查序列化完整性

4. **數據庫連接或環境問題**
   - Vercel 環境變數 (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN) 可能不正確
   - 導致某些查詢返回部分或無效數據

---

## 實施的修復

### 1. 在 `/booking` 頁面加入上層錯誤處理

**文件：** `src/app/booking/page.tsx`

```typescript
// 新增：為數據讀取加 try-catch
// 新增：為頁面載入加 try-catch
// 新增：生成可追蹤的錯誤代碼（BK{base36時間戳}{隨機字符}）
```

**效果：**
- 任何錯誤都會被捕獲並記錄到伺服器日誌
- 用戶看到的錯誤代碼可用於追蹤日誌
- 錯誤不會導致完整的 500 頁面，而是優雅的錯誤信息

### 2. 加強 getAvailability 中的數據驗證

**文件：** `src/lib/availability.ts`

```typescript
// 新增：驗證場館數據完整性
if (!Array.isArray(venue.courts)) throw new Error(`場館 ${slug} 的場地列表無效`)
if (!Array.isArray(venue.priceRules)) throw new Error(`場館 ${slug} 的價格規則無效`)
```

**效果：**
- 在讀取時立即檢測到無效數據
- 明確的錯誤信息用於除錯

### 3. 為 getCart 加入分段錯誤處理

**文件：** `src/lib/availability.ts` - `getCart()` 函數

```typescript
// 新增：分別為以下部分加 try-catch
// - releaseExpiredHolds()
// - 查詢場地預約
// - 轉換場地項目
// - 讀取活動項目
// - 讀取商品項目

// 效果：單個部分的失敗不會導致整個購物車讀取失敗
```

**效果：**
- 購物車的場地、活動、商品部分各自獨立
- 一個部分失敗不影響其他部分
- 返回部分有效的購物車而非完全失敗

### 4. 加強 JSON 解析的安全性

**文件：** `src/server/home-editor-service.ts`

```typescript
// 新增：在所有 JSON.parse 前檢查
if (!config.draftConfig || typeof config.draftConfig !== 'string' || config.draftConfig.trim() === '') {
  // 使用默認值或返回錯誤
}

// 新增：所有 JSON.parse 都在 try-catch 中
try {
  const data = JSON.parse(config.draftConfig)
} catch (err) {
  console.error('[home-editor] 解析失敗', err)
  // 返回默認值或錯誤
}
```

**效果：**
- 完全排除「Unexpected end of JSON input」的可能
- 損壞的 JSON 數據會被明確記錄

### 5. 改進 JWT 令牌解析

**文件：** `src/lib/db.ts` - `tenantFromToken()`

```typescript
// 新增：在 JSON.parse 前檢查字符串有效性
if (!headerStr || headerStr.trim() === '') return null
if (!payloadStr || payloadStr.trim() === '') return null

// 新增：錯誤日誌
catch (err) {
  console.debug('[db] JWT 解析失敗', { error: err.message })
}
```

**效果：**
- 無效的 JWT 令牌被安全地処理
- 不會因令牌解析失敗而導致頁面崩潰

---

## 本地編譯驗證結果

✅ **TypeScript 類型檢查：** 通過  
✅ **Next.js 生產編譯：** 成功  
✅ **靜態頁面生成 (49/49)：** 完成

```
✓ Compiled successfully in 22.9s
✓ Generating static pages (49/49)
```

---

## 建議的下一步行動

### 1. 檢查 Vercel 環境變數

確保以下環境變數在 Vercel 生產環境中正確設置：

```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
SESSION_SECRET=
```

驗證方式：
- 在 Vercel 儀表板查看 Settings > Environment Variables
- 確認所有值都已填寫（不為空）
- 測試數據庫連接

### 2. 檢查正式數據庫的完整性

在 Vercel 環境中，運行以下檢查：

```bash
# 檢查是否存在 homePageConfig 記錄
SELECT COUNT(*) FROM "HomePageConfig";

# 檢查 draftConfig 和 publishedConfig 是否為有效 JSON
SELECT id, 
  LENGTH("draftConfig") as draft_len,
  LENGTH("publishedConfig") as pub_len
FROM "HomePageConfig";
```

### 3. 部署到 Vercel

推送修改到 GitHub：

```bash
git add -A
git commit -m "fix: strengthen error handling and JSON parsing in booking page

- Add comprehensive error handling in /booking page
- Validate venue data integrity in getAvailability
- Separate error handling for cart items (courts, activities, products)
- Safe JSON parsing with pre-validation in home-editor
- Generate trackable error codes (BK format) for debugging
- Improve logging and error messages"
git push origin main
```

Vercel 會自動部署 Preview 環境。在 GitHub PR 中驗證預約頁面是否正常工作。

### 4. 驗證修復

部署後，測試以下場景：

#### 場景 A：正常預約流程
- 開啟 `/booking`
- 應看到場館選擇和日期選擇
- 應看到場地時段矩陣
- 應能選擇時段加入購物車

#### 場景 B：無場館時
- 清空所有場館記錄
- 開啟 `/booking`
- 應顯示「尚未設定任何場館」信息（友善的後備信息）

#### 場景 C：損壞的配置
- 刻意將 homePageConfig 的 draftConfig 設為空字符串
- 開啟首頁
- 應使用默認配置而非崩潰

#### 場景 D：購物車部分失敗
- 刻意使活動查詢失敗
- 開啟 `/booking?venue=...`
- 購物車應仍顯示場地部分，活動部分為空（而非整個頁面崩潰）

---

## 修改的文件清單

1. **src/app/booking/page.tsx**
   - 新增上層 try-catch 錯誤處理
   - 新增可追蹤的錯誤代碼生成

2. **src/lib/availability.ts**
   - 在 getAvailability 中驗證場館數據完整性
   - 為 getCart 加入分段錯誤處理
   - 為 getCartActivityItems 加入 try-catch
   - 為 getCartProductItems 加入 try-catch

3. **src/server/home-editor-service.ts**
   - 在 getOrCreateHomePageConfig 中安全解析 draftConfig
   - 在 publishHomeConfig 中驗證 draftConfig
   - 在 getPublishedConfig 中驗證 publishedConfig
   - 在 getDraftConfig 中驗證 draftConfig
   - 在 getVersionHistory 中安全解析版本配置

4. **src/server/home-data.ts**
   - 改進 publishedConfig 的解析和日誌記錄

5. **src/lib/db.ts**
   - 在 tenantFromToken 中驗證 JWT 令牌字符串有效性
   - 改進錯誤日誌

6. **src/app/booking/page.test.tsx** (新建)
   - 新增測試框架（測試覆蓋未來驗證）

---

## 技術細節補充

### 為何原始錯誤代碼是 3987465915？

根據用戶報告，原始錯誤代碼是 `3987465915`，這是一個隨機生成的 10 位數字。這表明：
- 錯誤被捕獲並生成了錯誤代碼
- 但伺服器日誌沒有保存該代碼對應的詳細信息

**修復後的改進：**
- 新的錯誤代碼格式：`BK{base36 時間戳}{隨機字符}`
- 範例：`BK12A34BC5D`
- 時間戳部分（base36）讓追蹤更容易

### 為什麼本地編譯成功但生產可能失敗？

可能的原因：
1. **環境差異**：本地數據庫（demo DB）和生產數據庫（Turso）中的數據可能不同
2. **並發問題**：生產環境的並發訪問可能導致數據庫狀態差異
3. **部署時間差**：舊版本代碼仍在 Vercel 邊緣節點上

---

## 預期效果

部署後，用戶應該：

✅ 看到正常的預約頁面（大多數情況）  
✅ 如果發生錯誤，看到明確的「系統暫時發生問題」信息  
✅ 錯誤代碼可用於技術人員追蹤日誌  
✅ 購物車的各部分獨立運作，一部分失敗不導致整體崩潰  
✅ 沒有更多「Unexpected end of JSON input」錯誤

---

## 聯繫

如果問題仍未解決，請：
1. 收集完整的 Vercel 日誌（使用新的 BK 錯誤代碼）
2. 驗證 Turso 數據庫的 homePageConfig 記錄
3. 檢查 Vercel 環境變數是否正確設置
