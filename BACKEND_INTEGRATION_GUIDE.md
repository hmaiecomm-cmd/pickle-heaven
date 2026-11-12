# Pickle Heaven 後台改版 V4 - 後端整合指南

## 📋 目錄

1. [環境配置](#環境配置)
2. [資料庫模型](#資料庫模型)
3. [LINE Login 整合](#line-login-整合)
4. [邀請系統實現](#邀請系統實現)
5. [API 權限檢查](#api-權限檢查)
6. [安全檢查清單](#安全檢查清單)

---

## 環境配置

### 1. LINE 開發者設定

**步驟：**

1. 前往 [LINE Developers](https://developers.line.biz/) 登入
2. 建立或選擇現有的 **LINE Provider**
3. 建立新的 **Channel** - 選擇 **LINE Login** 類型
4. 記錄以下資訊：
   - **Channel ID**
   - **Channel Secret**
   - **LIFF ID**（如果需要 MINI App）

5. 設定 **Callback URL**：
   ```
   http://localhost:3000/api/auth/line/callback  (開發)
   https://your-domain.com/api/auth/line/callback (正式)
   ```

6. 設定 **OpenID Connect** Scope：
   - openid
   - profile
   - email

### 2. 環境變數配置

複製 `.env.example` 並建立 `.env.local`：

```bash
cp .env.example .env.local
```

編輯 `.env.local`，填入你的值：

```env
# LINE Login
NEXT_PUBLIC_LINE_CLIENT_ID="YOUR_LINE_CHANNEL_ID"
LINE_CHANNEL_ID="YOUR_LINE_CHANNEL_ID"
LINE_CHANNEL_SECRET="YOUR_LINE_CHANNEL_SECRET"
LINE_LOGIN_REDIRECT_URI="http://localhost:3000/api/auth/line/callback"

# 後台 JWT
ADMIN_JWT_SECRET="generate-a-random-32-character-string"
```

**安全注意：**
- ✅ `NEXT_PUBLIC_*` 前綴的變數會暴露到前端（用於公開資訊）
- ⚠️ `LINE_CHANNEL_SECRET` 和 `ADMIN_JWT_SECRET` 永遠不要暴露到前端
- ⚠️ `.env.local` 應加入 `.gitignore`

---

## 資料庫模型

### Prisma Schema 擴展

需要添加以下模型到 `prisma/schema.prisma`：

```prisma
// ═══════════════════ 後台管理員 ═══════════════════

/// 後台使用者帳號
model AdminUser {
  id                String                 @id @default(cuid())
  
  /// 帳號（用於帳號密碼登入）
  username          String                 @unique
  /// 密碼雜湊
  passwordHash      String
  /// 顯示名稱
  displayName       String
  
  /// 角色
  role              AdminRole              @default(STAFF)
  
  /// 帳號狀態（active / suspended / disabled）
  status            String                 @default("active")
  
  /// 可存取的場館（null = 所有場館）
  allowedVenueIds   String[]               @default([])
  
  /// 最後登入時間
  lastLoginAt       DateTime?
  /// 登入失敗次數（用於防暴力破解）
  loginFailureCount Int                    @default(0)
  /// 登入失敗鎖定時間
  lockedUntil       DateTime?
  
  /// 強制修改密碼標誌
  mustChangePassword Boolean               @default(false)
  
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
  
  /// 關聯
  lineBindings      AdminLineBinding[]
  invitedBy         AdminInvitation[]      @relation("CreatedBy")
  auditLogs         AuditLog[]             @relation("Actor")
}

/// 管理員邀請
model AdminInvitation {
  id                String                 @id @default(cuid())
  
  /// 受邀者 email
  email             String
  /// 邀請 token（用於驗證邀請連結）
  token             String                 @unique
  
  /// 授予的角色
  role              AdminRole
  
  /// 限定的場館（null = 所有場館）
  venueId           String?
  
  /// 邀請狀態
  status            String                 @default("pending") // pending / accepted / expired / revoked
  
  /// 邀請有效期
  expiresAt         DateTime
  
  /// 使用時間（接受邀請）
  usedAt            DateTime?
  /// 使用者帳號（接受邀請的管理員）
  usedByAdminId     String?
  
  /// 建立人
  createdByAdminId  String
  createdBy         AdminUser              @relation("CreatedBy", fields: [createdByAdminId], references: [id])
  
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
  
  @@index([email])
  @@index([token])
  @@index([expiresAt])
  @@index([createdByAdminId])
}

/// 管理員 LINE 身份綁定
model AdminLineBinding {
  id                String                 @id @default(cuid())
  
  /// 後台帳號 ID
  adminId           String                 @unique
  admin             AdminUser              @relation(fields: [adminId], references: [id], onDelete: Cascade)
  
  /// LINE User ID
  lineUserId        String                 @unique
  /// LINE Email
  lineEmail         String?
  /// LINE 顯示名稱
  lineDisplayName   String?
  /// LINE 頭像 URL
  linePictureUrl    String?
  
  /// 綁定時間
  linkedAt          DateTime               @default(now())
  /// 最後 LINE 登入時間
  lastLoginAt       DateTime?
  
  updatedAt         DateTime               @updatedAt
  
  @@index([lineUserId])
}

/// 後台操作日誌
model AuditLog {
  id                String                 @id @default(cuid())
  
  /// 操作者
  adminId           String?
  admin             AdminUser?             @relation("Actor", fields: [adminId], references: [id], onDelete: SetNull)
  
  /// 操作類型（login, invite, role_change, disable, line_bind 等）
  action            String
  /// 資源類型（admin_user, admin_invitation 等）
  resourceType      String
  /// 資源 ID
  resourceId        String?
  
  /// 變更詳情（JSON）
  details           Json?
  
  /// IP 地址
  ipAddress         String?
  /// User Agent
  userAgent         String?
  
  createdAt         DateTime               @default(now())
  
  @@index([adminId])
  @@index([action])
  @@index([resourceType])
  @@index([createdAt])
}

enum AdminRole {
  OWNER        /// 擁有者（完全權限）
  MANAGER      /// 經理（場館管理）
  STAFF        /// 現場人員（基本操作）
  FINANCE      /// 財務（財務操作）
  MAINTENANCE  /// 維護人員（設備維護）
}
```

### Migration

```bash
# 生成 migration
npx prisma migrate dev --name add_admin_auth_models

# 套用 migration
npx prisma migrate deploy
```

---

## LINE Login 整合

### API 回調處理流程

已實現的文件：
- `src/app/api/auth/line/callback/route.ts`
- `src/lib/line-auth.ts`

### 執行步驟

1. **前端登入**
   - 使用者點擊「使用 LINE 登入」
   - 重導到 LINE 授權頁面
   - 使用者授權並重導回 `/api/auth/line/callback`

2. **後端驗證**
   ```typescript
   // 驗證流程：
   1. 驗證 code 與 state（防止 CSRF）
   2. 交換 code 獲取 ID token
   3. 解碼與驗證 ID token
   4. 檢查 issuer, audience, nonce, expiry
   5. 提取使用者信息（LINE User ID, email）
   ```

3. **帳號處理**
   ```typescript
   // 檢查是否已綁定
   const existingBinding = await getAdminByLineUserId(lineUserId)
   
   if (existingBinding) {
     // 帳號已存在，建立 session
     await updateLastLineLogin(existingBinding.adminId)
     // 建立 JWT session
   } else {
     // 檢查是否有有效邀請
     const invitation = await getInvitationByEmail(email)
     if (invitation && validateInvitation(invitation, email)) {
       // 使用邀請建立新帳號
       const newAdmin = await redeemInvitation({...})
       // 建立 JWT session
     } else {
       // 未授權
       return 403 Forbidden
     }
   }
   ```

### 實現檢查清單

- [ ] 環境變數配置完成
- [ ] Prisma Migration 執行
- [ ] ID Token 驗證邏輯已測試
- [ ] 帳號綁定邏輯已實現
- [ ] Session 管理已配置
- [ ] 錯誤處理已完善

---

## 邀請系統實現

### 建立邀請

```typescript
// src/server/admin-invitation-service.ts
const invitation = await createInvitation({
  email: 'newuser@example.com',
  role: 'manager',
  createdByAdminId: currentAdminId,
  expirationDays: 7,
})

// 發送邀請信
await sendInvitationEmail({
  to: 'newuser@example.com',
  invitationLink: `${NEXT_PUBLIC_APP_URL}/admin/login?invite=${invitation.token}`,
  expiresAt: invitation.expiresAt,
})
```

### 接受邀請

```typescript
// 使用者透過 LINE Login
const result = await redeemInvitation({
  invitationToken: urlParams.invite,
  email: lineEmail,
  lineUserId: idTokenPayload.sub,
  displayName: idTokenPayload.name,
})
```

### 權限檢查

- [ ] 只有 Owner 可建立邀請
- [ ] 邀請必須設定有效期限
- [ ] 邀請使用時必須驗證 email 相符
- [ ] 已使用的邀請不可重複使用
- [ ] 過期邀請應自動清理

---

## API 權限檢查

### 後端路由保護

在所有 admin API 路由添加權限檢查：

```typescript
import { pagePermission } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const permission = await pagePermission('settings')
  if (permission === 'forbidden') {
    return new Response('Forbidden', { status: 403 })
  }
  
  // ... 執行受保護的操作
}
```

### 敏感操作要求額外驗證

```typescript
// 例：撤銷管理員權限
export async function revokeAdmin(adminId: string, reason: string) {
  // 1. 檢查操作者是否為 Owner
  const actor = await getCurrentAdmin()
  if (actor.role !== 'OWNER') {
    throw new Error('Only owners can revoke admin privileges')
  }
  
  // 2. 記錄到 Audit Log
  await createAuditLog({
    adminId: actor.id,
    action: 'admin_revoke',
    resourceId: adminId,
    details: { reason }
  })
  
  // 3. 禁用帳號
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { status: 'disabled' }
  })
  
  // 4. 清除現有 session（迫使重新登入）
  await clearAdminSessions(adminId)
}
```

---

## 安全檢查清單

### OAuth 2.0 / OpenID Connect

- [x] Authorization Code Flow（已實現）
- [x] State parameter（已實現）
- [x] Nonce（已實現）
- [x] ID Token 驗證（已實現）
- [ ] 自動化測試
- [ ] 線上驗證

### 帳號安全

- [ ] 密碼雜湊（使用 bcrypt 或 argon2）
- [ ] 帳號鎖定（多次失敗登入）
- [ ] Session 超時
- [ ] 強制密碼修改
- [ ] 登出時清除 session

### 審計日誌

- [ ] 所有登入嘗試都記錄
- [ ] 權限變更記錄
- [ ] 敏感操作記錄
- [ ] IP 地址與 User Agent 記錄

### 資料隱私

- [ ] 不暴露密碼雜湊
- [ ] 不暴露 SESSION_SECRET
- [ ] LINE Channel Secret 保護
- [ ] 敏感資料加密存儲

---

## 部署清單

### 開發環境

```bash
# 1. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local，填入 LINE 測試 Channel ID/Secret

# 2. 執行 Migration
npx prisma migrate dev

# 3. 啟動開發服務器
npm run dev

# 4. 測試 LINE Login
# 訪問 http://localhost:3000/admin/login
```

### 測試環境

```bash
# 使用 LINE 測試帳號進行 E2E 測試
# 驗證邀請流程
# 驗證權限檢查
# 驗證 Audit Log 記錄
```

### 正式環境

```bash
# 1. 線上 LINE Channel 設定
# 更新 Channel Secret 為正式環境

# 2. 環境變數
NEXT_PUBLIC_LINE_CLIENT_ID=production_channel_id
LINE_CHANNEL_SECRET=production_secret_XXXXXXX
LINE_LOGIN_REDIRECT_URI=https://your-domain.com/api/auth/line/callback

# 3. 資料庫備份
# 執行 Migration

# 4. 部署
npm run build
npm run start
```

---

## 常見問題

### Q: 如何重置管理員密碼？

A: 管理員可透過 LINE Login 登入，或使用「忘記密碼」流程。

### Q: 如何撤銷 LINE 綁定？

A: 使用 `revokeLineBinding()` 函數，管理員必須重新使用帳號密碼登入。

### Q: 邀請過期後怎麼辦？

A: Owner 可重新發送邀請。過期邀請應於 30 天後自動清理。

### Q: 如何記錄所有敏感操作？

A: 使用 `createAuditLog()` 記錄每個重要操作。

---

**文件版本：** 2026-11-12  
**狀態：** 進行中
