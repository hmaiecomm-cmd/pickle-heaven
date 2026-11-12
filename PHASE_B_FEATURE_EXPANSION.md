# 🚀 選項 B：功能擴展 - 完整指南

**狀態：** 等待實現  
**預計時間：** 2-4 小時  
**難度：** 中等到高  
**負責人：** 開發團隊  

---

## 🎯 計劃的擴展功能

### 功能 B1：2FA 雙因素認證（優先度：高）

**用途：** 增強後台管理員賬號安全

**實現步驟：**

#### B1.1 數據庫擴展

```prisma
// 添加到 prisma/schema.prisma

model AdminMFA {
  id              String    @id @default(cuid())
  adminId         String    @unique
  admin           AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  
  // TOTP (Google Authenticator)
  totpSecret      String?   // 加密存儲
  totpEnabled     Boolean   @default(false)
  
  // 備用碼
  backupCodes     String?   // JSON 數組，每個都加密
  
  // 短信
  phoneNumber     String?
  smsEnabled      Boolean   @default(false)
  smsVerified     Boolean   @default(false)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([adminId])
}

model MFAAttempt {
  id              String    @id @default(cuid())
  adminId         String
  method          String    // 'totp', 'sms', 'backup'
  verified        Boolean   @default(false)
  attemptAt       DateTime  @default(now())
  
  @@index([adminId])
  @@index([attemptAt])
}
```

#### B1.2 Backend 實現

```typescript
// src/lib/mfa-service.ts

import { authenticator } from 'otplib';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export async function generateTOTPSecret(): Promise<MFASetupResponse> {
  const secret = authenticator.generateSecret();
  const appName = 'Pickle Heaven';
  const accountName = 'admin@picklehaven.local';
  
  const qrCode = authenticator.keyuri(accountName, appName, secret);
  
  // 生成 10 個備用碼
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  
  return { secret, qrCode, backupCodes };
}

export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  try {
    return authenticator.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // 允許 ±1 個時間窗口
    });
  } catch (error) {
    return false;
  }
}

export async function enableMFA(
  adminId: string,
  secret: string,
  backupCodes: string[]
): Promise<void> {
  await prisma.adminMFA.upsert({
    where: { adminId },
    update: {
      totpSecret: encryptSecret(secret),
      totpEnabled: true,
      backupCodes: encryptCodes(backupCodes),
    },
    create: {
      adminId,
      totpSecret: encryptSecret(secret),
      totpEnabled: true,
      backupCodes: encryptCodes(backupCodes),
    },
  });
}

function encryptSecret(secret: string): string {
  // 使用應用的加密密鑰加密
  // 實現取決於您的加密方案
  return secret; // 簡化版本
}

function encryptCodes(codes: string[]): string {
  return JSON.stringify(codes);
}
```

#### B1.3 API 端點

```typescript
// src/app/api/admin/mfa/setup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAuth } from '@/lib/admin-auth';
import { generateTOTPSecret } from '@/lib/mfa-service';

export async function POST(req: NextRequest) {
  await requireAuth(req);
  const admin = await getCurrentAdmin(req);
  
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { secret, qrCode, backupCodes } = await generateTOTPSecret();
    
    // 返回 QR 碼和備用碼供用戶掃描和保存
    return NextResponse.json({
      secret,
      qrCode,
      backupCodes,
      message: '請使用認證器應用掃描 QR 碼，並保存備用碼',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate MFA setup' },
      { status: 500 }
    );
  }
}
```

---

### 功能 B2：登入歷史記錄（優先度：高）

**用途：** 追蹤管理員登入活動，增進安全

#### B2.1 數據庫表

```prisma
model LoginHistory {
  id              String    @id @default(cuid())
  adminId         String
  admin           AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  
  method          String    // 'line', 'local', 'sso'
  ipAddress       String?
  userAgent       String?
  device          String?   // 瀏覽器/設備信息
  location        String?   // 地理位置（可選）
  
  success         Boolean   @default(true)
  failureReason   String?
  
  loginAt         DateTime  @default(now())
  
  @@index([adminId])
  @@index([loginAt])
  @@index([ipAddress])
}
```

#### B2.2 記錄登入

```typescript
// src/lib/login-history.ts

import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

export async function recordLogin(
  adminId: string,
  method: 'line' | 'local',
  success: boolean = true,
  failureReason?: string
): Promise<void> {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '';
  
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const device = `${result.browser.name} ${result.browser.version}`;
  
  await prisma.loginHistory.create({
    data: {
      adminId,
      method,
      ipAddress,
      userAgent,
      device,
      success,
      failureReason,
    },
  });
}
```

---

### 功能 B3：API 速率限制（優先度：中）

**用途：** 防止暴力攻擊和 DDoS

#### B3.1 安裝依賴

```bash
npm install @upstash/redis @upstash/ratelimit
```

#### B3.2 實現

```typescript
// src/lib/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 15 分鐘 5 次
  analytics: true,
});

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 1 分鐘 100 次
  analytics: true,
});

export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<boolean> {
  const result = await limiter.limit(identifier);
  return result.success;
}
```

#### B3.3 在 API 中使用

```typescript
// 在 login API 中
import { loginRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
  
  const allowed = await loginRateLimit.limit(ipAddress);
  if (!allowed.success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 }
    );
  }
  
  // ... 登入邏輯
}
```

---

### 功能 B4：多語言支持（優先度：低）

**用途：** 支持英文、繁體中文、簡體中文

#### B4.1 安裝 i18n

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

#### B4.2 翻譯文件

```json
// src/locales/zh-TW.json
{
  "auth": {
    "login": "登入",
    "logout": "登出",
    "email": "電郵",
    "password": "密碼",
    "forgotPassword": "忘記密碼？",
    "loginError": "登入失敗，請檢查您的憑證"
  },
  "dashboard": {
    "welcome": "歡迎",
    "overview": "總覽",
    "settings": "設置"
  }
}
```

```json
// src/locales/en.json
{
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot Password?",
    "loginError": "Login failed. Please check your credentials"
  },
  "dashboard": {
    "welcome": "Welcome",
    "overview": "Overview",
    "settings": "Settings"
  }
}
```

#### B4.3 配置 i18n

```typescript
// src/lib/i18n.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhTW from '@/locales/zh-TW.json';
import en from '@/locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': { translation: zhTW },
      en: { translation: en },
    },
    fallbackLng: 'zh-TW',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

---

## 📋 實現優先順序

| # | 功能 | 優先度 | 預計時間 | 難度 |
|---|------|--------|---------|------|
| B1 | 2FA 雙因素認證 | 高 | 2 小時 | 中 |
| B2 | 登入歷史記錄 | 高 | 1 小時 | 易 |
| B3 | API 速率限制 | 中 | 45 分 | 中 |
| B4 | 多語言支持 | 低 | 1.5 小時 | 易 |

**總計：** 4-5 小時

---

## 🚀 實現檢查清單

### B1：2FA 雙因素認證
- [ ] 添加 AdminMFA 數據表
- [ ] 添加 MFAAttempt 日誌表
- [ ] 實現 TOTP 生成和驗證
- [ ] 添加設置 MFA 的 API
- [ ] 添加驗證 MFA 的 API
- [ ] 添加恢復碼支持
- [ ] 前端 UI 設置頁面
- [ ] 測試 Google Authenticator 兼容性

### B2：登入歷史記錄
- [ ] 添加 LoginHistory 表
- [ ] 修改登入邏輯記錄歷史
- [ ] 添加查詢登入歷史的 API
- [ ] 添加登入歷史前端頁面
- [ ] 添加異常登入告警

### B3：API 速率限制
- [ ] 配置 Upstash Redis
- [ ] 實現速率限制中間件
- [ ] 應用於登入端點
- [ ] 應用於其他敏感端點
- [ ] 添加速率限制監控
- [ ] 測試不同場景

### B4：多語言支持
- [ ] 安裝 i18next
- [ ] 編寫翻譯文件
- [ ] 配置 i18n 初始化
- [ ] 更新所有文本組件
- [ ] 添加語言切換器
- [ ] 測試所有語言
- [ ] 驗證日期/時間格式本地化

---

## 📝 評估標準

每個功能實現完成後的驗收標準：

**B1 2FA**
- [ ] 用戶可成功設置 TOTP
- [ ] QR 碼可被 Google Authenticator 掃描
- [ ] 備用碼可用於登入
- [ ] 啟用/禁用 MFA 正常運作

**B2 登入歷史**
- [ ] 所有登入都被記錄
- [ ] 歷史可按日期、用戶過濾
- [ ] IP 地址和設備信息正確
- [ ] 頁面加載時間 < 500ms

**B3 速率限制**
- [ ] 超過限制的請求返回 429
- [ ] 合法請求不受影響
- [ ] 限制規則生效
- [ ] 監控面板顯示限制統計

**B4 多語言**
- [ ] 所有 UI 文本已翻譯
- [ ] 語言切換器工作正常
- [ ] 日期格式按語言本地化
- [ ] 沒有硬編碼的中文或英文

---

## 🔄 後續集成

這些功能與選項 C（系統集成）相關：
- 2FA 增加整體系統安全性
- 登入歷史可用於審計其他系統的訪問
- 速率限制保護整合的 API
- 多語言支持跨所有系統

---

**下一步：實現這些功能或繼續選項 C（系統集成）** 🚀
