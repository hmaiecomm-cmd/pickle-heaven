# 🎯 步驟 2：實施功能擴展 - 完整實現指南

**日期：** 2026-11-12  
**狀態：** 執行中  
**總預計時間：** 2-4 小時（4 項功能）  

---

## 🚀 功能 B1：2FA 雙因素認證（優先度：高，2 小時）

### 實施清單

#### Step 1：數據庫擴展（10 分鐘）

```bash
# 創建新的 migration
npx prisma migrate dev --name add_mfa_system

# 選擇「Create a new migration」
```

編輯生成的 migration 文件：

```prisma
-- prisma/migrations/[timestamp]_add_mfa_system/migration.sql

CREATE TABLE "AdminMFA" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "adminId" TEXT NOT NULL UNIQUE,
  "totpSecret" TEXT,
  "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "backupCodes" TEXT,
  "phoneNumber" TEXT,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE
);

CREATE TABLE "MFAAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "adminId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "attemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminMFA_adminId_idx" ON "AdminMFA"("adminId");
CREATE INDEX "MFAAttempt_adminId_idx" ON "MFAAttempt"("adminId");
```

更新 schema.prisma：

```prisma
// 添加到 prisma/schema.prisma

model AdminMFA {
  id            String    @id @default(cuid())
  adminId       String    @unique
  admin         AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  totpSecret    String?
  totpEnabled   Boolean   @default(false)
  backupCodes   String?
  phoneNumber   String?
  smsEnabled    Boolean   @default(false)
  smsVerified   Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([adminId])
}

model MFAAttempt {
  id        String   @id @default(cuid())
  adminId   String
  method    String
  verified  Boolean  @default(false)
  attemptAt DateTime @default(now())

  @@index([adminId])
  @@index([attemptAt])
}

// 在 AdminUser model 中添加關聯
model AdminUser {
  // ... 現有字段
  mfa       AdminMFA?
}
```

執行 migration：

```bash
npx prisma migrate deploy
npx prisma generate
```

#### Step 2：後端 TOTP 服務（20 分鐘）

安裝依賴：

```bash
npm install speakeasy qrcode
```

創建 TOTP 服務：

```typescript
// src/lib/totp-service.ts

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';

export async function generateTOTPSecret(adminEmail: string) {
  const secret = speakeasy.generateSecret({
    name: `Pickle Heaven (${adminEmail})`,
    issuer: 'Pickle Heaven',
    length: 32,
  });

  const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

  // 生成 10 個備用碼
  const backupCodes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
  };
}

export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

export async function enableMFA(
  adminId: string,
  secret: string,
  backupCodes: string[]
): Promise<void> {
  await prisma.adminMFA.upsert({
    where: { adminId },
    update: {
      totpSecret: secret,
      totpEnabled: true,
      backupCodes: JSON.stringify(backupCodes),
    },
    create: {
      adminId,
      totpSecret: secret,
      totpEnabled: true,
      backupCodes: JSON.stringify(backupCodes),
    },
  });
}

export async function verifyBackupCode(
  adminId: string,
  code: string
): Promise<boolean> {
  const mfa = await prisma.adminMFA.findUnique({ where: { adminId } });
  if (!mfa?.backupCodes) return false;

  const codes = JSON.parse(mfa.backupCodes);
  return codes.includes(code);
}
```

#### Step 3：MFA API 端點（25 分鐘）

```typescript
// src/app/api/admin/mfa/setup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAuth } from '@/lib/admin-auth';
import { generateTOTPSecret } from '@/lib/totp-service';

export async function GET(req: NextRequest) {
  await requireAuth(req);
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { secret, qrCode, backupCodes } = await generateTOTPSecret(admin.email!);
    return NextResponse.json({ secret, qrCode, backupCodes });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate MFA' }, { status: 500 });
  }
}
```

```typescript
// src/app/api/admin/mfa/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAuth, logAuditEvent } from '@/lib/admin-auth';
import { verifyTOTP, enableMFA } from '@/lib/totp-service';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  await requireAuth(req);
  const admin = await getCurrentAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { secret, token, backupCodes } = await req.json();

  // 驗證 TOTP token
  if (!verifyTOTP(secret, token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // 啟用 MFA
  await enableMFA(admin.id, secret, backupCodes);

  // 審計日誌
  await logAuditEvent({
    adminId: admin.id,
    action: 'mfa_enabled',
    resource: 'admin_mfa',
    status: 'success',
  });

  return NextResponse.json({ success: true, message: 'MFA enabled' });
}
```

#### Step 4：前端組件（25 分鐘）

```typescript
// src/components/admin/mfa-setup-form.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function MFASetupForm() {
  const [step, setStep] = useState<'init' | 'qr' | 'verify' | 'done'>('init');
  const [qrCode, setQrCode] = useState<string>();
  const [backupCodes, setBackupCodes] = useState<string[]>();
  const [secret, setSecret] = useState<string>();
  const [token, setToken] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mfa/setup');
      const data = await res.json();
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setSecret(data.secret);
      setStep('qr');
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token, backupCodes }),
      });
      if (res.ok) {
        setStep('done');
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      {step === 'init' && (
        <Button onClick={handleSetup} disabled={loading}>
          啟用 2FA
        </Button>
      )}
      {step === 'qr' && (
        <div>
          <h3>掃描 QR 碼</h3>
          {qrCode && <Image src={qrCode} alt="QR" width={200} height={200} />}
          <div className="mt-4">
            <label>6 位驗證碼</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
          </div>
          <Button onClick={handleVerify} disabled={loading || !token}>
            驗證
          </Button>
        </div>
      )}
      {step === 'done' && (
        <div>
          <h3>✅ 2FA 已啟用</h3>
          <p>備用碼（妥善保管）：</p>
          <ul>
            {backupCodes?.map((code, i) => (
              <li key={i}>{code}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### ✅ 功能 B1 檢查清單
- [ ] Migration 已執行
- [ ] TOTP 服務已實現
- [ ] API 端點已建立
- [ ] 前端組件已創建
- [ ] 測試通過

---

## 🔄 功能 B2-B4（其他 3 項功能）

### 功能 B2：登入歷史（1 小時）
- 數據庫表：LoginHistory
- API：GET /api/admin/login-history
- 前端：登入歷史頁面

### 功能 B3：速率限制（45 分鐘）
- Upstash Redis 集成
- 限制規則配置
- 監控儀表板

### 功能 B4：多語言（1.5 小時）
- i18next 框架
- 翻譯文件
- 語言切換器

---

## 📊 進度統計

```
【功能 B1】2FA 雙因素認證
  ✅ 數據庫設計      (10 分鐘)
  ✅ 後端服務        (20 分鐘)
  ✅ API 端點        (25 分鐘)
  ✅ 前端組件        (25 分鐘)
  └─ 小計：80 分鐘（1.5 小時）

【功能 B2】登入歷史記錄
  ├─ 數據庫表         (5 分鐘)
  ├─ 記錄邏輯         (10 分鐘)
  ├─ API 端點         (15 分鐘)
  └─ 小計：30 分鐘（0.5 小時）

【功能 B3】API 速率限制
  ├─ Redis 配置       (15 分鐘)
  ├─ 限制中間件       (15 分鐘)
  ├─ 規則應用         (10 分鐘)
  └─ 小計：40 分鐘（0.7 小時）

【功能 B4】多語言支持
  ├─ i18next 配置     (15 分鐘)
  ├─ 翻譯文件         (30 分鐘)
  ├─ 組件更新         (25 分鐘)
  └─ 小計：70 分鐘（1.2 小時）

總計：2.9 小時（約 3 小時）
```

---

## 🎯 功能擴展完成後

所有 4 項功能實現完成後的驗收：

- ✅ 所有 API 端點工作正常
- ✅ 前端組件集成完美
- ✅ 數據正確保存和檢索
- ✅ 安全性測試通過
- ✅ 性能指標達到目標

---

**功能擴展完成後，進入步驟 3：系統集成開發** 🔗
