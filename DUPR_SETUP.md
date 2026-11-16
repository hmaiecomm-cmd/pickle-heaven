# DUPR 智慧賽事系統集成 — 環境設置指南

> **最後更新**: 2026-11-16
> **狀態**: STEP 02 完成 — 後端框架實裝

---

## 📋 必需環境變數

### 加密密鑰（必填）

```bash
# 生成新的加密密鑰
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 輸出範例
# abc123def456abc123def456abc123def456abc123def456abc123def456abc1

# 設置到 .env
DUPR_ENCRYPTION_KEY="your-generated-key-here"
```

**用途**：
- 安全存儲 DUPR OAuth Token
- 使用 AES-256-GCM 加密
- 必須是 32 字節的 hex 字符串（64 個十六進制字符）

### DUPR 官方 API（開發用 Mock，正式待授權）

```bash
# 目前使用 Mock Adapter（模擬數據）
# 當 DUPR 官方授權後，將以下設置為真實值

DUPR_CLIENT_ID=""              # DUPR OAuth Client ID
DUPR_CLIENT_SECRET=""          # DUPR OAuth Client Secret
DUPR_API_URL=""                # DUPR API 基礎 URL
```

**預期值**（當授權後）：
- `DUPR_CLIENT_ID`: 類似 `dupr_app_1234567890`
- `DUPR_CLIENT_SECRET`: 隨機字符串
- `DUPR_API_URL`: `https://api.dupr.gg` 或類似

---

## 🔧 設置步驟

### Step 1: 生成加密密鑰

```bash
# 在任何目錄執行
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 複製輸出值
```

### Step 2: 更新 .env 文件

編輯 `.env`，添加：

```bash
# ══════════════════ DUPR 智慧賽事系統 ══════════════════
# Token 加密密鑰（AES-256-GCM）
DUPR_ENCRYPTION_KEY="your-generated-32-byte-hex-key"

# DUPR OAuth 應用設置（待官方授權）
DUPR_CLIENT_ID=""
DUPR_CLIENT_SECRET=""
DUPR_API_URL="https://mock.dupr.local"  # 開發用，正式改為 https://api.dupr.gg
```

### Step 3: 重新生成 Prisma Client

```bash
npm run db:generate
```

### Step 4: 驗證設置

```bash
# 檢查 TypeScript 編譯
npm run typecheck

# 預期：無 DUPR 相關的編譯錯誤
```

---

## 🧪 驗證安裝

### 檢查清單

```bash
# ✅ 1. Prisma Client 已生成
ls node_modules/.prisma/client/index.d.ts

# ✅ 2. 環境變數已設置
grep DUPR_ENCRYPTION_KEY .env

# ✅ 3. TypeScript 編譯正常
npm run typecheck

# ✅ 4. 服務層可以載入
npm run build
```

### 手動測試（Postman / cURL）

#### 1️⃣ 生成授權 URL

```bash
curl -X POST http://localhost:3000/api/auth/dupr/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# 預期回應
{
  "success": true,
  "authUrl": "https://mock.dupr.local/oauth/authorize?...",
  "state": "abc123..."
}
```

#### 2️⃣ 測試 OAuth Callback（Mock）

```bash
# 使用 Mock Adapter 模擬回調
curl -X GET "http://localhost:3000/api/auth/dupr/callback?code=mock_code_123&state=abc123"

# 預期：重定向到 /dupr/link-success 或 /dupr/link-error
```

---

## 📊 API 端點清單

| 端點 | 方法 | 功能 | 需身份驗證 |
|------|------|------|----------|
| `/api/auth/dupr/authorize` | POST | 生成授權 URL | ✅ 是 |
| `/api/auth/dupr/callback` | GET | 處理 OAuth 回調 | ✅ 是 |

---

## 🔐 安全考量

### Token 加密

所有 DUPR OAuth Token 都以 AES-256-GCM 加密存儲：

```typescript
// 自動加密
const encrypted = encryptToken(token)
// 格式: "encrypted:base64-encoded-iv-tag-ciphertext"

// 自動解密
const decrypted = decryptToken(encrypted)
```

### CSRF 防護

每次授權都生成唯一的 state：

```
1. 前端請求 /api/auth/dupr/authorize
   → 服務器生成 state，存儲在 DuprApiLog
   
2. 重定向到 DUPR 授權頁面
   → URL 中帶 state 參數
   
3. DUPR 重定向回 /api/auth/dupr/callback?state=...
   → 驗證 state 與數據庫中的記錄匹配
   
4. ❌ 如果 state 不匹配 → 拒絕連結
```

---

## 🐛 常見問題

### Q: DUPR_ENCRYPTION_KEY 錯誤

**症狀**:
```
Error: DUPR_ENCRYPTION_KEY 環境變數未設置。無法加密/解密 Token。
```

**解決**:
1. 確保 `.env` 中有 `DUPR_ENCRYPTION_KEY`
2. 值必須是 64 個十六進制字符（32 字節）
3. 重啟開發伺服器

### Q: OAuth Callback 失敗

**症狀**:
```
重定向到 /dupr/link-error?error=callback_failed
```

**排查**:
1. 檢查 DUPR_CLIENT_ID 和 DUPR_CLIENT_SECRET 是否設置（如果使用官方 API）
2. 確認 Callback URL 與 DUPR 應用設置中的一致
3. 查看伺服器日誌：`[DUPR Callback]` 字樣

### Q: CSRF 驗證失敗

**症狀**:
```
CSRF 驗證失敗: state 不存在或已過期
```

**原因**:
- State 在數據庫中已被刪除
- 使用了舊的 state 參數
- 數據庫連接問題

**解決**:
- 重新生成授權 URL（新的 state）
- 確保 Prisma Client 可以連接到數據庫

---

## 📚 相關文檔

- [PRISMA_ISSUE_EXPLANATION.md](./PRISMA_ISSUE_EXPLANATION.md) — Prisma 問題詳細說明
- [src/lib/dupr-encryption.ts](./src/lib/dupr-encryption.ts) — Token 加密工具
- [src/server/dupr/service.ts](./src/server/dupr/service.ts) — DUPR 服務層
- [src/server/dupr/adapter.ts](./src/server/dupr/adapter.ts) — DUPR Adapter 介面

---

## 🚀 下一步（STEP 03）

前端集成：
- [ ] DUPR 連結按鈕 UI 組件
- [ ] 授權流程（調用 `/api/auth/dupr/authorize`）
- [ ] 成功/失敗頁面（`/dupr/link-success` 和 `/dupr/link-error`）
- [ ] 球員評級展示
- [ ] 解除連結功能

後端新增：
- [ ] `GET /api/dupr/me` — 查詢當前用戶的 DUPR 連結狀態
- [ ] `DELETE /api/dupr/link` — 解除連結
- [ ] `POST /api/dupr/sync-ratings` — 手動同步評級
- [ ] 前端表單集成測試

---

**有問題？** 查看 [PRISMA_ISSUE_EXPLANATION.md](./PRISMA_ISSUE_EXPLANATION.md) 或聯繫開發團隊
