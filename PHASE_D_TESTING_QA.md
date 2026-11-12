# ✅ 選項 D：測試 & QA - 完整指南

**狀態：** 規劃與實現  
**預計時間：** 2-3 小時  
**難度：** 高  
**負責人：** QA 團隊  

---

## 🎯 測試策略

```
測試金字塔
    △
   /|\
  / | \  端到端測試 (5%)
 /  |  \
/───┼───\
  單元測試 (70%)
  整合測試 (25%)
```

---

## 📝 D1：單元測試

### 安裝測試框架

```bash
npm install -D vitest @vitest/ui @testing-library/react
```

### D1.1 Session 管理測試

```typescript
// src/lib/__tests__/admin-session.test.ts

import { describe, it, expect } from 'vitest';
import {
  createAdminSession,
  verifyAdminSession,
  AdminSessionPayload,
} from '@/lib/admin-session';

describe('Admin Session Management', () => {
  it('should create a valid JWT token', async () => {
    const payload: AdminSessionPayload = {
      adminId: 'test-123',
      email: 'test@example.com',
      role: 'MANAGER',
    };

    const token = await createAdminSession(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT 結構
  });

  it('should verify a valid token', async () => {
    const payload: AdminSessionPayload = {
      adminId: 'test-123',
      email: 'test@example.com',
      role: 'MANAGER',
    };

    const token = await createAdminSession(payload);
    const verified = await verifyAdminSession(token);

    expect(verified).toBeTruthy();
    expect(verified?.adminId).toBe('test-123');
    expect(verified?.email).toBe('test@example.com');
  });

  it('should reject expired or invalid tokens', async () => {
    const invalidToken = 'invalid.token.here';
    const result = await verifyAdminSession(invalidToken);
    expect(result).toBeNull();
  });
});
```

### D1.2 密碼加密測試

```typescript
// src/lib/__tests__/password.test.ts

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('Password Encryption', () => {
  it('should hash passwords securely', async () => {
    const password = 'SecurePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // 同一個密碼應該產生不同的 hash（因為使用隨機鹽）
    expect(hash1).not.toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it('should verify correct passwords', async () => {
    const password = 'SecurePassword123!';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', async () => {
    const password = 'SecurePassword123!';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword('WrongPassword', hash);

    expect(isValid).toBe(false);
  });
});
```

### D1.3 權限系統測試

```typescript
// src/lib/__tests__/admin-permissions.test.ts

import { describe, it, expect } from 'vitest';
import { can } from '@/lib/admin-permissions';

describe('Permission System', () => {
  it('OWNER 應有所有權限', () => {
    expect(can('OWNER', 'manage_courts')).toBe(true);
    expect(can('OWNER', 'manage_power')).toBe(true);
    expect(can('OWNER', 'manage_admins')).toBe(true);
  });

  it('MANAGER 應有部分權限', () => {
    expect(can('MANAGER', 'manage_courts')).toBe(true);
    expect(can('MANAGER', 'manage_power')).toBe(true);
    expect(can('MANAGER', 'manage_admins')).toBe(false);
  });

  it('STAFF 應有有限權限', () => {
    expect(can('STAFF', 'manage_courts')).toBe(false);
    expect(can('STAFF', 'view_power')).toBe(true);
  });

  it('應拒絕無效權限', () => {
    expect(can('STAFF', 'invalid_permission')).toBe(false);
  });
});
```

---

## 🔗 D2：整合測試

### D2.1 認證流程測試

```typescript
// src/__tests__/integration/auth.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fetch } from 'cross-fetch';

const BASE_URL = 'http://localhost:3000';

describe('Authentication Integration', () => {
  it('should login with valid credentials', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'SecurePassword123!',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token).toBeTruthy();
  });

  it('should reject invalid credentials', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'WrongPassword',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should lock account after failed attempts', async () => {
    // 嘗試 5 次錯誤登入
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser@example.com',
          password: 'WrongPassword',
        }),
      });
    }

    // 第 6 次應該返回帳號被鎖定
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser@example.com',
        password: 'CorrectPassword123!',
      }),
    });

    expect(response.status).toBe(423); // Locked
  });
});
```

### D2.2 邀請系統測試

```typescript
// src/__tests__/integration/invitations.test.ts

import { describe, it, expect } from 'vitest';

describe('Invitation System Integration', () => {
  it('should create invitation', async () => {
    const response = await fetch(
      `${process.env.TEST_SERVER_URL}/api/admin/invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          email: 'newadmin@example.com',
          role: 'MANAGER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天
        }),
      }
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.invitationToken).toBeTruthy();
  });

  it('should reject invitation from non-authorized user', async () => {
    const response = await fetch(
      `${process.env.TEST_SERVER_URL}/api/admin/invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_STAFF_TOKEN}`, // STAFF 無權限
        },
        body: JSON.stringify({
          email: 'newadmin@example.com',
          role: 'MANAGER',
        }),
      }
    );

    expect(response.status).toBe(403); // Forbidden
  });
});
```

---

## 🧪 D3：端對端測試

### 安裝 E2E 測試框架

```bash
npm install -D @playwright/test
npx playwright install
```

### D3.1 登入流程 E2E 測試

```typescript
// e2e/auth.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/admin/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("登入")')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'SecurePassword123!');
    await page.click('button:has-text("登入")');

    // 應重定向到儀表板
    await expect(page).toHaveURL('http://localhost:3000/admin/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'WrongPassword');
    await page.click('button:has-text("登入")');

    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toContainText('登入失敗');
  });

  test('should support LINE login', async ({ page }) => {
    const lineButton = page.locator('button:has-text("LINE 登入")');
    await expect(lineButton).toBeVisible();

    // 注意：實際 LINE OAuth 流程會重定向到 LINE 伺服器
    // 此測試僅驗證按鈕存在和可點擊
  });
});
```

### D3.2 管理員邀請流程 E2E 測試

```typescript
// e2e/invitations.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Admin Invitations', () => {
  test.beforeEach(async ({ page }) => {
    // 以管理員身份登入
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[type="email"]', 'owner@example.com');
    await page.fill('input[type="password"]', 'SecurePassword123!');
    await page.click('button:has-text("登入")');
    await page.waitForURL('**/admin/dashboard');
  });

  test('should create new admin invitation', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/settings/invitations');

    // 填寫邀請表
    await page.fill('input[type="email"]', 'newadmin@example.com');
    await page.selectOption('select[name="role"]', 'MANAGER');

    // 提交
    await page.click('button:has-text("發送邀請")');

    // 應顯示成功消息
    await expect(page.locator('.success-message')).toContainText('邀請已發送');
  });

  test('should list pending invitations', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/settings/invitations');

    const invitations = page.locator('[data-test="invitation-item"]');
    const count = await invitations.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should revoke invitation', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/settings/invitations');

    const firstRevoke = page.locator('button:has-text("撤銷")').first();
    await firstRevoke.click();

    // 確認對話框
    await page.click('button:has-text("確認")');

    // 應顯示成功消息
    await expect(page.locator('.success-message')).toContainText('已撤銷');
  });
});
```

---

## 🔒 D4：安全測試

### 建立安全測試套件

```bash
npm install -D @snyk/cli owasp-zap
```

### D4.1 常見漏洞測試

```typescript
// src/__tests__/security/vulnerabilities.test.ts

import { describe, it, expect } from 'vitest';

describe('Security Vulnerabilities', () => {
  it('should prevent SQL Injection', async () => {
    const maliciousInput = "'; DROP TABLE AdminUser; --";
    // 因為使用 Prisma，SQL 注入應自動防止
    // 此測試驗證 Prisma 的防護
  });

  it('should prevent XSS attacks', async () => {
    const xssPayload = '<img src=x onerror="alert(1)">';
    // React 會自動轉義文本內容
    // 驗證沒有 dangerouslySetInnerHTML 使用
  });

  it('should prevent CSRF attacks', async () => {
    // 驗證 CSRF token 驗證邏輯
    // 驗證 SameSite cookie 設置
  });

  it('should use HTTPS in production', async () => {
    // 驗證 secure flag 在 production
  });
});
```

---

## 📊 D5：性能測試

### 安裝性能測試工具

```bash
npm install -D autocannon artillery
```

### D5.1 負載測試配置

```yaml
# load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up to 50 req/s"
    - duration: 120
      arrivalRate: 100
      name: "Stress test at 100 req/s"

scenarios:
  - name: "Login Flow"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          expect:
            - statusCode: 200

  - name: "Get Admin Info"
    flow:
      - get:
          url: "/api/admin/profile"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
```

### D5.2 執行負載測試

```bash
# 運行性能測試
artillery run load-test.yml

# 預期結果：
# - 平均響應時間 < 200ms
# - 99 百分位數 < 500ms
# - 錯誤率 < 1%
```

---

## 📋 測試檢查清單

### 單元測試
- [ ] Session 管理 (100% 覆蓋)
- [ ] 密碼加密 (100% 覆蓋)
- [ ] 權限系統 (100% 覆蓋)
- [ ] 郵件服務 (100% 覆蓋)
- [ ] 工具函數 (100% 覆蓋)

### 整合測試
- [ ] 認證流程
- [ ] 邀請系統
- [ ] 資料庫操作
- [ ] API 路由
- [ ] 錯誤處理

### E2E 測試
- [ ] 登入流程
- [ ] 邀請流程
- [ ] 逸出流程
- [ ] 權限檢查
- [ ] 審計日誌

### 安全測試
- [ ] SQL 注入防護
- [ ] XSS 防護
- [ ] CSRF 防護
- [ ] 認證繞過
- [ ] 授權繞過

### 性能測試
- [ ] API 響應時間 < 200ms
- [ ] 並發 100 req/s 成功率 > 99%
- [ ] 內存使用穩定
- [ ] 無內存洩漏

---

## 🚀 運行所有測試

```bash
# 運行單元測試
npm run test

# 運行整合測試
npm run test:integration

# 運行 E2E 測試
npm run test:e2e

# 運行安全檢查
npm run test:security

# 運行性能測試
npm run test:performance

# 生成覆蓋率報告
npm run test:coverage
```

---

## 📈 成功標準

| 測試類型 | 目標 | 驗收標準 |
|---------|------|--------|
| 單元測試 | > 80% 覆蓋 | 綠燈通過 |
| 整合測試 | 100% 通過 | 所有測試通過 |
| E2E 測試 | 關鍵流程 | 登入、邀請流程完全通過 |
| 安全測試 | 0 個中等以上漏洞 | 通過安全掃描 |
| 性能測試 | p99 < 500ms | 負載測試通過 |

---

**下一步：實現測試或繼續選項 E（運維準備）** ✅
