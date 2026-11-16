# STEP 04 — 集成測試與優化

**預計耗時**: 3-5 天  
**難度**: 中等  
**優先順序**: API 測試 → E2E 測試 → 性能優化

---

## 📋 STEP 04 工作分解

### 第一階段：API 集成測試（1-2 天）

#### 1️⃣ 後端 API 單元測試

**文件**: `src/app/api/dupr/__tests__/routes.test.ts`

```typescript
describe('DUPR API Routes', () => {
  describe('GET /api/dupr/me', () => {
    it('未登入應返回 401', async () => {
      const res = await fetch('/api/dupr/me')
      expect(res.status).toBe(401)
    })

    it('已連結應返回球員信息', async () => {
      // 使用 test user token
      const res = await fetch('/api/dupr/me', {
        headers: { 'Cookie': 'session=test-token' }
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.linked).toBe(true)
      expect(data.data).toHaveProperty('duprPlayerId')
    })

    it('未連結應返回 null', async () => {
      const res = await fetch('/api/dupr/me', {
        headers: { 'Cookie': 'session=new-user-token' }
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.linked).toBe(false)
    })
  })

  describe('POST /api/dupr/sync-ratings', () => {
    it('應同步最新評級', async () => {
      const res = await fetch('/api/dupr/sync-ratings', {
        method: 'POST',
        headers: { 'Cookie': 'session=test-token' }
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('singlesRating')
      expect(data.data).toHaveProperty('doublesRating')
    })
  })

  describe('DELETE /api/dupr/link', () => {
    it('應解除連結', async () => {
      const res = await fetch('/api/dupr/link', {
        method: 'DELETE',
        headers: { 'Cookie': 'session=test-token' }
      })
      expect(res.status).toBe(200)
      
      // 驗證已解除
      const checkRes = await fetch('/api/dupr/me', {
        headers: { 'Cookie': 'session=test-token' }
      })
      const data = await checkRes.json()
      expect(data.linked).toBe(false)
    })
  })
})
```

---

#### 2️⃣ 數據庫狀態驗證

**文件**: `src/app/api/dupr/__tests__/db.test.ts`

```typescript
describe('DUPR Database State', () => {
  it('DuprPlayerLink 應正確保存 Token', async () => {
    // 查詢數據庫
    const link = await prisma.duprPlayerLink.findUnique({
      where: { userId: 'test-user' }
    })
    
    expect(link).toBeDefined()
    expect(link?.accessToken).toContain('encrypted:')
    expect(link?.singlesRating).toBeGreaterThan(0)
  })

  it('DuprApiLog 應記錄所有調用', async () => {
    // 查詢日誌
    const logs = await prisma.duprApiLog.findMany({
      where: { userId: 'test-user' },
      orderBy: { requestAt: 'desc' },
      take: 5
    })
    
    expect(logs.length).toBeGreaterThan(0)
    logs.forEach(log => {
      expect(log.endpoint).toBeDefined()
      expect(log.statusCode).toBeGreaterThanOrEqual(200)
    })
  })

  it('Token 加密應無法直接讀取', async () => {
    const link = await prisma.duprPlayerLink.findUnique({
      where: { userId: 'test-user' },
      select: { accessToken: true }
    })
    
    // Token 應以 'encrypted:' 開頭
    expect(link?.accessToken).toMatch(/^encrypted:/)
    // Token 不應包含原始的 oauth 字符串
    expect(link?.accessToken).not.toContain('oauth')
  })
})
```

---

### 第二階段：E2E 流程測試（1-2 天）

#### 1️⃣ 完整 OAuth 流程

**文件**: `src/__tests__/dupr-e2e.test.ts`

```typescript
describe('DUPR Complete OAuth Flow', () => {
  it('完整連結 → 查詢 → 同步 → 解除連結流程', async () => {
    const userId = 'test-e2e-user'

    // 1️⃣ 初始狀態：未連結
    let res = await fetch('/api/dupr/me', {
      headers: { 'Cookie': `session=${userId}` }
    })
    let data = await res.json()
    expect(data.linked).toBe(false)

    // 2️⃣ 生成授權 URL
    res = await fetch('/api/auth/dupr/authorize', {
      method: 'POST',
      headers: { 'Cookie': `session=${userId}` }
    })
    data = await res.json()
    expect(data.authUrl).toBeDefined()
    expect(data.state).toBeDefined()

    // 3️⃣ 模擬 OAuth callback
    res = await fetch(
      `/api/auth/dupr/callback?code=mock_code&state=${data.state}`,
      { headers: { 'Cookie': `session=${userId}` } }
    )
    // 應重定向到成功頁面
    expect(res.status).toBe(307) // redirect
    expect(res.headers.get('location')).toContain('/dupr/link-success')

    // 4️⃣ 驗證已連結
    res = await fetch('/api/dupr/me', {
      headers: { 'Cookie': `session=${userId}` }
    })
    data = await res.json()
    expect(data.linked).toBe(true)
    expect(data.data.playerName).toBeDefined()

    // 5️⃣ 同步評級
    res = await fetch('/api/dupr/sync-ratings', {
      method: 'POST',
      headers: { 'Cookie': `session=${userId}` }
    })
    data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.syncedAt).toBeDefined()

    // 6️⃣ 解除連結
    res = await fetch('/api/dupr/link', {
      method: 'DELETE',
      headers: { 'Cookie': `session=${userId}` }
    })
    data = await res.json()
    expect(data.success).toBe(true)

    // 7️⃣ 驗證已解除
    res = await fetch('/api/dupr/me', {
      headers: { 'Cookie': `session=${userId}` }
    })
    data = await res.json()
    expect(data.linked).toBe(false)
  })

  it('重複連結相同帳號應被阻止', async () => {
    // 用戶 A 連結 DUPR 帳號
    // 用戶 B 嘗試連結相同帳號
    // 應返回錯誤
  })

  it('CSRF 狀態驗證應正確工作', async () => {
    // 生成 state
    const authorizeRes = await fetch('/api/auth/dupr/authorize', {
      method: 'POST'
    })
    const { state } = await authorizeRes.json()

    // 使用錯誤的 state
    const callbackRes = await fetch(
      `/api/auth/dupr/callback?code=mock_code&state=invalid-state`
    )
    expect(callbackRes.status).toBe(307)
    expect(callbackRes.headers.get('location')).toContain('link-error')
  })
})
```

---

#### 2️⃣ 前端集成測試

**文件**: `src/app/account/dupr-tab/__tests__/integration.test.ts`

```typescript
describe('DUPR Frontend Integration', () => {
  it('帳戶頁面應正確渲染 DUPR tab', () => {
    // 訪問 /account?tab=dupr
    // 應顯示 DuprLinkCard
    // 未連結時應顯示「立即連結」按鈕
  })

  it('點擊「立即連結」應打開授權對話框', () => {
    // 點擊按鈕
    // 對話框應出現
    // popup 應打開
  })

  it('授權完成應自動刷新狀態', () => {
    // 完成授權
    // 應接收 postMessage
    // 頁面應更新為已連結狀態
    // 應顯示球員信息
  })

  it('「刷新評級」應同步最新評級', () => {
    // 點擊刷新按鈕
    // 應調用 POST /api/dupr/sync-ratings
    // 應顯示加載中狀態
    // 評級應更新
  })

  it('「解除連結」應要求確認', () => {
    // 點擊解除連結
    // 應顯示確認對話框
    // 確認後應調用 DELETE /api/dupr/link
    // 頁面應回到未連結狀態
  })
})
```

---

### 第三階段：性能測試與優化（1-2 天）

#### 1️⃣ API 性能測試

```bash
# 測試端點響應時間
ab -n 100 -c 10 http://localhost:3000/api/dupr/me

# 期望：
# - 平均響應時間 < 200ms
# - 99% 響應時間 < 500ms
# - 無超時
```

#### 2️⃣ 數據庫查詢優化

```typescript
// 優化前：每次查詢都要從 DB 讀取 Token
// 優化後：使用 Redis 緩存（可選）

// 評級緩存策略：
// - 首次查詢：從 DUPR API 取得
// - 24 小時內：使用本地快取
// - 超過 24 小時：自動同步
// - 用戶主動刷新：即時同步
```

#### 3️⃣ 前端性能優化

```typescript
// 優化前：
// - 每次打開帳戶頁面都調用 GET /api/dupr/me
// - 沒有加載骨架屏

// 優化後：
// - 使用 SWR 或 React Query 自動緩存
// - 添加加載骨架屏
// - Lazy 載入大型組件
```

---

## 🧪 測試運行方式

### 本地測試

```bash
# 1️⃣ 安裝測試依賴
npm install --save-dev vitest @testing-library/react

# 2️⃣ 運行所有測試
npm run test

# 3️⃣ 運行特定測試
npm run test -- dupr

# 4️⃣ 查看測試覆蓋率
npm run test -- --coverage

# 5️⃣ 監聽模式
npm run test -- --watch
```

### Postman 測試

```
1. 導入 Postman collection (DUPR.postman_collection.json)
2. 設置環境變數：
   - base_url: http://localhost:3000
   - test_token: your-session-token
3. 運行完整 OAuth 流程測試
```

---

## ✅ 測試檢查清單

- [ ] API 單元測試全部通過
- [ ] E2E 流程測試全部通過
- [ ] 前端集成測試全部通過
- [ ] 代碼覆蓋率 > 80%
- [ ] 沒有 TypeScript 錯誤
- [ ] 沒有 console 警告
- [ ] 性能測試通過 (< 200ms avg)
- [ ] 錯誤處理完整
- [ ] CSRF 防護驗證
- [ ] Token 加密驗證

---

## 🎯 成功標誌

STEP 04 完成當以下條件都滿足時：

✅ 所有測試通過 (> 95%)  
✅ API 性能達標  
✅ 前端無 console 錯誤  
✅ 完整 OAuth 流程驗證  
✅ CSRF 防護有效  
✅ Token 加密無誤  
✅ 數據庫狀態正確  
✅ 用戶體驗順暢  

---

## 📊 預期交付物

- ✅ 完整測試套件 (300+ 行測試代碼)
- ✅ Postman Collection
- ✅ 性能基準測試報告
- ✅ 測試覆蓋率報告
- ✅ 優化前後對比

---

**下一步**: 開始實裝 API 單元測試

簽署: Claude Haiku 4.5  
日期: 2026-11-16
