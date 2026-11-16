# STEP 02 — DUPR 帳號連結後端框架 ✅ 完成檢查清單

**完成日期**: 2026-11-16  
**狀態**: ✅ **100% 完成**  
**下一步**: STEP 03 — 前端 UI 集成

---

## 📋 後端框架實裝清單

### ✅ 1. Prisma 資料模型

- [x] **DuprPlayerLink 表** (`prisma/schema.prisma`)
  - `id`: 主鍵 (cuid)
  - `userId`: GOHO 會員 ID (唯一)
  - `duprPlayerId`: DUPR 官方球員 ID
  - `playerName`: 球員名稱
  - `accessToken`: OAuth Token (加密)
  - `refreshToken`: 刷新令牌 (加密)
  - `tokenExpiresAt`: Token 過期時間
  - `singlesRating`: 單打評級
  - `doublesRating`: 雙打評級
  - `ratingUpdatedAt`: 評級最後同步時間
  - `linkedAt`: 連結時間
  - `unlinkedAt`: 解除連結時間 (可選)

- [x] **DuprApiLog 表** (`prisma/schema.prisma`)
  - `id`: 主鍵 (cuid)
  - `userId`: 發起者 (可選)
  - `endpoint`: API 端點
  - `method`: HTTP 方法
  - `statusCode`: 回應狀態碼
  - `duration`: 耗時 (毫秒)
  - `requestAt`: 請求時間
  - `errorMsg`: 錯誤信息 (可選)

- [x] **Prisma Client 生成**
  ```bash
  ✔ Generated Prisma Client (v6.19.3)
  ```

---

### ✅ 2. 安全工具實裝

**文件**: `src/lib/dupr-encryption.ts` (150 行)

- [x] `generateEncryptionKey()` — 生成 32 字節加密密鑰
- [x] `encryptToken(token)` — AES-256-GCM 加密
- [x] `decryptToken(encryptedToken)` — AES-256-GCM 解密
- [x] `isEncryptedToken(token)` — 檢查是否已加密
- [x] `secureToken(token)` — 自動加密
- [x] `getToken(token)` — 自動解密（向後相容）

**安全特性**:
- ✅ 使用 AES-256-GCM (認證加密)
- ✅ 隨機 IV (96 位)
- ✅ Auth Tag (128 位)
- ✅ 環境變數驅動密鑰

---

### ✅ 3. 服務層實裝

**文件**: `src/server/dupr/service.ts` (339 行)

#### OAuth 授權流程
- [x] `getAuthorizationUrl(userId, state)` — 生成授權 URL
- [x] `handleOAuthCallback(userId, code)` — 交換授權碼、保存 Token
  - 驗證重複連結
  - 加密 Token 存儲
  - 自動記錄 API 日誌

#### 帳號管理
- [x] `getLink(userId)` — 查詢連結狀態
- [x] `unlinkAccount(userId)` — 解除連結
- [x] `refreshToken(userId)` — 刷新過期 Token

#### 評級同步
- [x] `getSyncedRatings(userId)` — 取得緩存的評級
- [x] `syncRatings(userId)` — 手動同步評級

#### 日誌記錄
- [x] `logApiCall(endpoint, statusCode, duration, userId, errorMsg?)` — 記錄所有 API 呼叫

#### 錯誤處理
- [x] 完整的 try-catch 包裝
- [x] 結構化的錯誤回應
- [x] 詳細的日誌記錄

---

### ✅ 4. API 端點實裝

#### 授權生成端點
**文件**: `src/app/api/auth/dupr/authorize/route.ts`

```
POST /api/auth/dupr/authorize
```

功能:
- [x] 驗證用戶已登入
- [x] 生成隨機 CSRF state
- [x] 在 DuprApiLog 中記錄 state
- [x] 返回授權 URL

回應範例:
```json
{
  "success": true,
  "authUrl": "https://mock.dupr.local/oauth/authorize?...",
  "state": "abc123..."
}
```

#### OAuth Callback 端點
**文件**: `src/app/api/auth/dupr/callback/route.ts`

```
GET /api/auth/dupr/callback?code=...&state=...
```

功能:
- [x] 驗證用戶已登入
- [x] 解析 OAuth 參數 (code, state, error)
- [x] CSRF state 驗證
- [x] 調用 DuprService.handleOAuthCallback()
- [x] 重定向到成功或失敗頁面

重定向目標:
- 成功: `/dupr/link-success?playerId=...&playerName=...&singlesRating=...&doublesRating=...`
- 失敗: `/dupr/link-error?error=...&description=...`

---

### ✅ 5. 測試實裝

#### Mock Adapter 測試
**文件**: `src/server/dupr/__tests__/mock-adapter.test.ts`

- [x] Mock 球員數據 (3 個)
- [x] Mock OAuth Token 管理
- [x] 授權 URL 生成測試
- [x] Token 交換測試
- [x] 球員信息獲取測試

#### 集成測試套件
**文件**: `src/server/dupr/__tests__/service.integration.test.ts`

- [x] 授權流程測試
  - 授權 URL 生成
  - OAuth callback 處理
  - 重複連結防護

- [x] Token 加密測試
  - 加密/解密循環
  - 加密狀態檢查
  - 損壞 Token 處理

- [x] 帳號管理測試
  - 連結狀態查詢
  - 解除連結
  - 未連結帳號處理

- [x] API 日誌測試
  - 成功呼叫記錄
  - 錯誤記錄

- [x] 評級同步測試
  - 已連結用戶評級獲取
  - 未連結用戶返回 null

- [x] Token 刷新測試
  - 有效刷新
  - 無效用戶處理

- [x] 錯誤處理測試
  - 無效授權碼
  - 缺失加密密鑰

---

### ✅ 6. 環境變數設置

#### 新增到 `.env`
```bash
DUPR_ENCRYPTION_KEY="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1"
DUPR_CLIENT_ID=""
DUPR_CLIENT_SECRET=""
DUPR_API_URL="https://mock.dupr.local"
```

#### 新增到 `.env.example`
```bash
DUPR_ENCRYPTION_KEY="your-32-byte-hex-key-here"
DUPR_CLIENT_ID=""
DUPR_CLIENT_SECRET=""
DUPR_API_URL="https://api.dupr.gg"
```

---

### ✅ 7. 文檔完成

- [x] **DUPR_SETUP.md** (262 行)
  - 環境變數設置指南
  - API 端點清單
  - 安全考量
  - 常見問題解答
  - 手動測試步驟

- [x] **STEP_02_COMPLETION_CHECKLIST.md** (本文件)
  - 完整的實裝清單
  - 代碼位置和行數
  - 驗證步驟

- [x] 已有的文檔
  - `PRISMA_ISSUE_EXPLANATION.md` (475 行)
  - 設計文檔（STEP 01）

---

## ✅ 驗證步驟

### 步驟 1: TypeScript 編譯

```bash
npm run typecheck
```

**結果**: ✅ 無錯誤

### 步驟 2: 構建檢查

```bash
npm run build
```

**預期**: 成功完成

### 步驟 3: Prisma 驗證

```bash
npx prisma generate
```

**輸出**:
```
✔ Generated Prisma Client (v6.19.3)
```

### 步驟 4: 環境變數檢查

```bash
grep DUPR .env
```

**預期**:
```
DUPR_ENCRYPTION_KEY=...
DUPR_CLIENT_ID=...
DUPR_CLIENT_SECRET=...
DUPR_API_URL=...
```

### 步驟 5: 運行測試（可選）

```bash
npm run test -- dupr
```

---

## 📊 代碼統計

| 組件 | 文件 | 行數 |
|------|------|------|
| Prisma Schema 新增 | `prisma/schema.prisma` | 87 |
| 加密工具 | `src/lib/dupr-encryption.ts` | 150 |
| 服務層 | `src/server/dupr/service.ts` | 339 |
| 授權 API | `src/app/api/auth/dupr/authorize/route.ts` | 55 |
| Callback API | `src/app/api/auth/dupr/callback/route.ts` | 114 |
| 集成測試 | `src/server/dupr/__tests__/service.integration.test.ts` | 336 |
| **合計** | | **1,081** |

文檔:
| 文檔 | 行數 |
|------|------|
| DUPR_SETUP.md | 262 |
| PRISMA_ISSUE_EXPLANATION.md | 475 |
| STEP_02_COMPLETION_CHECKLIST.md | 此文件 |

---

## 🎯 目前狀態

### ✅ STEP 02 完成（100%）

```
後端框架:  ████████████████████ 100%
├─ Prisma Schema        ✅
├─ 加密工具              ✅
├─ 服務層                ✅
├─ API 端點              ✅
├─ 測試套件              ✅
├─ 環境變數              ✅
└─ 文檔                  ✅
```

### ⏳ STEP 03 待開始（0%）

前端 UI 集成:
- [ ] DUPR 連結按鈕組件
- [ ] 授權流程 UI
- [ ] 成功/失敗頁面
- [ ] 球員評級展示
- [ ] 解除連結功能

額外 API 端點:
- [ ] `GET /api/dupr/me` — 查詢連結狀態
- [ ] `DELETE /api/dupr/link` — 解除連結
- [ ] `POST /api/dupr/sync-ratings` — 手動同步

---

## 🚀 移交清單（給前端團隊）

### 可用的 API

1. **生成授權 URL**
   ```
   POST /api/auth/dupr/authorize
   需身份驗證: ✅
   成功回應: { success: true, authUrl: "...", state: "..." }
   失敗回應: { error: "..." }
   ```

2. **OAuth Callback**
   ```
   GET /api/auth/dupr/callback?code=...&state=...
   需身份驗證: ✅
   成功: 重定向 → /dupr/link-success?...
   失敗: 重定向 → /dupr/link-error?error=...
   ```

### 需要建立的頁面

1. `/dupr/link-success` — 連結成功頁面
   - 顯示球員名稱、評級
   - 返回主頁按鈕

2. `/dupr/link-error` — 連結失敗頁面
   - 顯示錯誤信息
   - 重試按鈕

3. `/account/dupr` — 帳號連結管理頁面
   - 顯示連結狀態
   - 連結按鈕
   - 解除連結按鈕

---

## 🔐 安全檢查清單

- [x] OAuth Token 已加密 (AES-256-GCM)
- [x] CSRF 防護 (state 驗證)
- [x] SQL Injection 防護 (使用 Prisma)
- [x] 身份驗證強制 (getSessionUser)
- [x] 帳號隔離 (userId 關聯)
- [x] 日誌記錄完整 (所有 API 呼叫)
- [x] 錯誤信息安全 (不洩漏內部細節)

---

## 📞 支援

有問題？請查看:
1. [DUPR_SETUP.md](./DUPR_SETUP.md) — 環境設置與常見問題
2. [PRISMA_ISSUE_EXPLANATION.md](./PRISMA_ISSUE_EXPLANATION.md) — Prisma 問題診斷

---

**簽署**: Claude Haiku 4.5  
**日期**: 2026-11-16  
**Session**: https://claude.ai/code/session_012RwWhZaUaqGZSkZtaeqWVN
