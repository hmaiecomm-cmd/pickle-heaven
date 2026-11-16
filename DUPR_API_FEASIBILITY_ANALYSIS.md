# DUPR 智慧賽事系統 — API 可行性分析 & 授權檢查

**文件版本**：1.0  
**建立日期**：2026-11-16  
**負責人**：GOHO 後端團隊

---

## 一、DUPR API 現況概述

### 1.1 官方信息來源

| 項目 | 內容 |
|------|------|
| **官方網站** | https://www.duprpickleball.com/ |
| **開發者文件** | https://api.duprpickleball.com/docs（需確認） |
| **Partner Program** | https://www.duprpickleball.com/partners（需確認） |
| **技術支援** | api-support@duprpickleball.com（需確認） |

> ⚠️ **必須執行**：直接聯繫 DUPR 官方以確認正確的 API 端點和文件位置

### 1.2 DUPR 服務類型

DUPR（Double Pickleball Usage Rating）提供：
- **官方球員評級系統**：基於比賽結果自動計算 skill level
- **比賽管理**：與官方合作的賽事組織者可提交比賽結果
- **球員檔案**：查詢球員的公開信息（名稱、評級、統計）

---

## 二、API 端點需求分析

### 2.1 我們計畫使用的 API

| 功能 | 端點 (推測) | 方法 | 優先級 | 狀態 |
|------|-----------|------|--------|------|
| **球員信息查詢** | `GET /api/v1/players/{playerId}` | GET | 🔴 必須 | ❓ 待確認 |
| **球員登入授權** | `POST /api/v1/oauth/authorize` | POST | 🔴 必須 | ❓ 待確認 |
| **取得評級** | `GET /api/v1/players/{playerId}/rating` | GET | 🔴 必須 | ❓ 待確認 |
| **提交比賽結果** | `POST /api/v1/matches/submit` | POST | 🟡 重要 | ❓ 待確認 |
| **查詢比賽結果** | `GET /api/v1/matches/{matchId}` | GET | 🟡 重要 | ❓ 待確認 |
| **球員統計** | `GET /api/v1/players/{playerId}/stats` | GET | 🟢 選填 | ❓ 待確認 |

### 2.2 認證方式

根據業界標準（待確認）：

```
可能的認證方式：
1. OAuth 2.0 Authorization Code Flow（推薦球員登入）
2. API Key + Secret（推薦後端 server-to-server）
3. JWT Bearer Token（可能的方式）
```

**我們的選擇**：
- **前台球員**：OAuth 2.0（取得球員同意，安全不洩漏密碼）
- **後端服務**：API Key（用於自動提交比賽結果）

---

## 三、授權流程設計

### 3.1 前台：球員 OAuth 登入

```
1. 球員點擊「連結 DUPR 帳號」
2. 重定向到 DUPR 官方授權頁面
3. 球員同意授權（可查看名稱、評級、身份）
4. DUPR 回傳授權碼 + 重定向回我們的 callback URL
5. 後端用授權碼換取 Access Token
6. 存儲 Token（加密）、Player ID、Rating
7. 球員可隨時查看和解除連結
```

### 3.2 後端：服務帳號授權

```
1. 在 DUPR Partner Dashboard 申請 API Key 和 Secret
2. 保存在環境變數（production 環境由 Vercel 管理）
3. 所有 server-to-server 請求都使用此 credentials
4. 實施速率限制和錯誤重試機制
```

---

## 四、安全需求清單

### 4.1 密碼與 Token 保護

| 項目 | 要求 | 實裝方式 |
|------|------|--------|
| **球員密碼** | ❌ 絕不儲存 | 使用 OAuth，不需密碼 |
| **Access Token** | ✅ 加密儲存 | 使用 Prisma + Turso，欄位加密 |
| **Refresh Token** | ✅ 加密儲存 | 同上 |
| **API Key** | ✅ 環境變數 | `.env` 不上傳，Vercel 環境變數管理 |
| **API Secret** | ✅ 環境變數 | 同上 |

### 4.2 授權檢查

```typescript
// 每次調用 DUPR API 前應檢查：
1. Token 是否已過期
2. 球員是否撤銷授權
3. 球員是否為黑名單用戶
4. 賽事是否符合官方認可資格
```

### 4.3 稽核與日誌

```typescript
// 記錄所有 DUPR API 呼叫：
- 時間戳、使用者 ID、操作類型、請求、回應、結果
- 用於除錯和安全稽核
```

---

## 五、資料庫表設計（預備）

### 5.1 新增表（將在 STEP 02 實施）

```prisma
/// 球員 DUPR 帳號連結
model DuprPlayerLink {
  id             String    @id @default(cuid())
  userId         String    @unique  // GOHO 會員 ID
  duprPlayerId   String             // DUPR 官方 Player ID
  playerName     String             // 姓名（DUPR 官方）
  
  // OAuth Token 管理
  accessToken    String   // 加密儲存
  refreshToken   String?  // 加密儲存
  tokenExpiresAt DateTime  // 過期時間
  
  // 評級快取（避免每次都查詢）
  singlesRating  Float?    // Singles skill level
  doublesRating  Float?    // Doubles skill level
  ratingUpdatedAt DateTime? // 最後同步時間
  
  // 連結管理
  linkedAt       DateTime  @default(now())
  unlinkedAt     DateTime? // 解除連結時間
  
  // 額外信息
  note           String?   // 內部備註
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([duprPlayerId])
  @@index([linkedAt])
}

/// DUPR API 呼叫日誌
model DuprApiLog {
  id         String   @id @default(cuid())
  userId     String?  // 關聯球員（若適用）
  endpoint   String   // e.g., "GET /players/{id}"
  method     String   // GET, POST, etc.
  status     Int      // HTTP status code
  
  requestAt  DateTime @default(now())
  duration   Int      // 毫秒
  
  // 用於除錯
  error      String?  // 如果發生錯誤
  createdAt  DateTime @default(now())
  
  @@index([endpoint, requestAt])
  @@index([userId, requestAt])
}
```

---

## 六、Mock API Adapter 設計

### 6.1 目的

在官方 API 授權尚未取得之前，使用 Mock Adapter 允許：
- ✅ 本機開發和測試
- ✅ 前端 UI 完整開發
- ✅ 後端邏輯驗證
- ❌ 但不能聲稱已串接真實 DUPR 系統

### 6.2 實裝位置

```
src/server/dupr/
├── adapter.ts          # 抽象 interface
├── mock-adapter.ts     # 開發/測試用
└── official-adapter.ts # 正式授權後實裝
```

### 6.3 Mock Adapter 回傳範例

```typescript
// Mock：球員查詢
{
  playerId: "DUPR123456",
  name: "張三",
  location: "台北市",
  singlesRating: 3.25,
  doublesRating: 3.40,
  matchesPlayed: 47,
  winPercentage: 0.55
}

// Mock：OAuth 授權
{
  accessToken: "mock_token_12345",
  expiresIn: 3600,
  tokenType: "Bearer"
}
```

---

## 七、當前檢查結果 & 建議

### 7.1 ✅ 我們已準備好的部分

- ✅ 資料庫架構完整（Turso + Prisma）
- ✅ 會員系統到位（可掛載 DUPR 連結）
- ✅ 活動系統完整（可擴展為 DUPR 活動）
- ✅ 後台管理系統（可新增 DUPR 管理頁面）
- ✅ 認證框架就位（OAuth ready）
- ✅ 環境變數管理（Vercel 已設置）

### 7.2 🔴 必須行動項目

**優先級最高**（建議立即執行）：

1. **直接聯繫 DUPR 官方**
   - 詢問 Partner API 申請流程
   - 索取 API 文件和 Postman collection
   - 確認認證方式和 OAuth endpoints
   - 詢問成為「官方賽事認可」的條件

2. **評估法律與商業協議**
   - 確認 DUPR 對球員數據使用的限制
   - 確認可否存儲評級快取
   - 確認可否在我們平台顯示 DUPR 評級
   - 確認比賽提交是否需要額外授權

3. **進度時程**
   - 預期審核期：7–14 天
   - 測試環境取得：同時期
   - 生產環境上線：獲批後 3–5 天

### 7.3 🟡 中期行動項目

4. **選擇實裝策略**（取決於官方授權結果）
   - 方案 A：完整正式串接（官方授權）→ 進行 STEP 01–13
   - 方案 B：Mock Adapter 示範（官方拒絕）→ 進行 STEP 01–13 改用 Mock
   - 方案 C：延遲實裝（官方未回應）→ 先實裝其他功能

5. **開發環境準備**
   - 建立 Mock Adapter（本週）
   - 建立測試環境配置
   - 準備 Postman collection

---

## 八、決策表

| 決策項 | 選項 | 我們的決定 | 備註 |
|--------|------|---------|------|
| **認證方式** | OAuth 2.0 vs API Key | 兩者混用 | 前台 OAuth、後端 API Key |
| **Token 存儲** | 加密 vs 明文 | 加密 | 使用 Prisma 欄位加密 |
| **評級同步** | 即時 vs 定期 | 定期快取 | 每 4 小時一次，避免限速 |
| **失敗處理** | 嚴格 vs 寬鬆 | 寬鬆降級 | API 失敗不中斷用戶流程 |
| **官方授權前** | 停止 vs Mock | Mock 開發 | 允許前端 UI 同步開發 |

---

## 九、下一步行動

### STEP 01 完成清單

- [ ] 聯繫 DUPR 官方（需用戶執行）
- [ ] 獲取 API 文件和測試憑證
- [x] 建立 API Adapter 設計文件（本文件）
- [ ] 建立 Mock Adapter 實裝（STEP 01 後期）

### 進入 STEP 02 的前置條件

✅ **可以進行**：
- Mock Adapter 開發完成
- DUPR 帳號連結資料表設計完成
- 前端 UI 設計完成

❌ **不得進行**（在官方授權前）：
- 使用正式 API 端點
- 聲稱已串接 DUPR 系統

---

## 附錄 A：常見問題與假設

### Q1：如果 DUPR 官方拒絕授權怎麼辦？

**A**：我們仍可使用 Mock Adapter 提供完整的 DUPR 模擬功能，供內部測試和演示使用。使用者手動輸入評級評分。

### Q2：球員評級會實時同步嗎？

**A**：不會。每 4 小時同步一次快取，避免 API 速率限制。球員可手動「重新同步」。

### Q3：如果授權被撤銷怎麼辦？

**A**：立即將 linkedAt → unlinkedAt，停止所有 API 調用，顯示「帳號已斷開」。

### Q4：可以跨會員綁定嗎？

**A**：不可。`DuprPlayerLink.userId` 設為 `@unique`，每個 GOHO 會員只能連結一個 DUPR 帳號。

---

**文件狀態**：✅ 完成初稿  
**下一次更新**：收到 DUPR 官方回應後

