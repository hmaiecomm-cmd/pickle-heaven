# 📊 步驟 3-6：系統集成、測試、運維、新功能

---

## 🔗 步驟 3：系統集成開發（2-3 小時）

### 集成 C1：電力控制系統（45 分鐘）

```bash
# 1. 安裝 MQTT 客戶端
npm install mqtt

# 2. 創建電力客戶端
# src/lib/power-control-client.ts (200+ 行)

# 3. 實現 API 路由
# src/app/api/admin/power/status/route.ts
# src/app/api/admin/power/circuits/[id]/toggle/route.ts

# 4. 前端儀表板
# src/components/admin/power-dashboard.tsx

# 5. 測試連接
npm run dev
# 訪問 http://localhost:3001/admin/power
```

### 集成 C2：門禁系統（45 分鐘）

```bash
# 1. 創建門禁客戶端
# src/lib/door-access-client.ts

# 2. 實現 API
# src/app/api/admin/access/records/route.ts
# src/app/api/admin/access/cards/[id]/route.ts

# 3. 訪問記錄頁面
# src/components/admin/access-logs.tsx

# 4. 驗證功能
curl http://localhost:3001/api/admin/access/records
```

### 集成 C3：LINE 通知（30 分鐘）

```bash
# 1. 創建通知中心
# src/lib/line-notification-hub.ts

# 2. 實現告警方法
# - sendToAdmin()
# - sendToRole()
# - sendPowerAlert()
# - sendAccessAlert()

# 3. 集成到警報流程
# 在 power/route.ts 中調用 sendPowerAlert()
# 在 access/route.ts 中調用 sendAccessAlert()
```

### 集成 C4：權限統一（30 分鐘）

```typescript
// src/lib/admin-permissions-extended.ts

export const EXTENDED_PERMISSIONS = {
  // 新增權限
  view_power: 'STAFF',
  manage_power: 'MANAGER',
  view_access: 'STAFF',
  manage_access: 'MANAGER',
  manage_finance: 'FINANCE',
  manage_maintenance: 'MAINTENANCE',
};

// 更新 can() 函數以支持所有系統
```

### ✅ 集成檢查清單
- [ ] MQTT 連接穩定
- [ ] 所有 API 返回 200
- [ ] 審計日誌記錄完整
- [ ] LINE 通知送達
- [ ] 權限檢查正確

---

## ✅ 步驟 4：設置測試框架（2-3 小時）

### D1：單元測試（1 小時）

```bash
# 安裝 Vitest
npm install -D vitest @vitest/ui @testing-library/react

# 創建測試
touch src/lib/__tests__/admin-session.test.ts
touch src/lib/__tests__/password.test.ts
touch src/lib/__tests__/permissions.test.ts

# 運行測試
npm run test
npm run test:ui
```

**目標：** 80%+ 覆蓋率，所有綠色通過

### D2：整合測試（0.5 小時）

```bash
# 創建整合測試
touch src/__tests__/integration/auth.test.ts
touch src/__tests__/integration/invitations.test.ts

# 運行測試
npm run test:integration
```

### D3：E2E 測試（0.5 小時）

```bash
# 安裝 Playwright
npm install -D @playwright/test
npx playwright install

# 創建測試
touch e2e/auth.spec.ts
touch e2e/invitations.spec.ts

# 運行測試
npm run test:e2e
```

### D4：安全和性能測試（0.5 小時）

```bash
# 依賴掃描
npm audit

# 負載測試
npm install -D artillery
artillery run load-test.yml

# 安全掃描
snyk test
```

### ✅ 測試檢查清單
- [ ] 單元測試 > 80% 覆蓋
- [ ] 整合測試 100% 通過
- [ ] E2E 測試 100% 通過
- [ ] 安全掃描 0 個中等漏洞
- [ ] 性能測試 p99 < 500ms

---

## 📊 步驟 5：配置運維系統（1-2 小時）

### E1：Sentry 錯誤追蹤（20 分鐘）

```bash
# 安裝 SDK
npm install @sentry/nextjs

# 配置
export SENTRY_DSN=your-sentry-dsn
export SENTRY_AUTH_TOKEN=your-token

# 驗證
curl -X POST https://sentry.io/api/0/projects/org/project/events/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN"
```

### E2：Datadog APM（20 分鐘）

```bash
# 配置
export DD_TRACE_ENABLED=true
export DD_APM_ENABLED=true
export DD_API_KEY=your-api-key
export DD_SITE=datadoghq.com

# 驗證儀表板
# https://app.datadoghq.com/apm/services
```

### E3：日誌聚合（15 分鐘）

```bash
# 配置 PM2 日誌輪轉
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M

# 驗證
pm2 logs pickle-heaven
```

### E4：備份系統（15 分鐘）

```bash
# 創建備份腳本
cat > backup.sh << 'EOF'
#!/bin/bash
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz
EOF

chmod +x backup.sh

# 設置 Cron
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup.sh") | crontab -
```

### E5：安全審計（15 分鐘）

```bash
# 定期掃描
npm audit --production
snyk test --production
dependency-check --project "Pickle Heaven" --scan ./node_modules
```

### ✅ 運維檢查清單
- [ ] Sentry 收到錯誤
- [ ] Datadog 顯示指標
- [ ] 日誌正常輪轉
- [ ] 備份自動執行
- [ ] 安全掃描通過

---

## 🚀 步驟 6：其他新功能/新項目

### 可選功能清單

| 功能 | 難度 | 時間 | 優先度 |
|------|------|------|--------|
| WebSocket 實時通知 | 高 | 2 小時 | 中 |
| 系統儀表板 Dashboard | 中 | 1.5 小時 | 高 |
| 批量操作功能 | 中 | 1 小時 | 中 |
| 數據匯出功能 | 易 | 30 分 | 低 |
| API 文檔生成 | 易 | 30 分 | 高 |
| 性能優化 | 高 | 2 小時 | 中 |
| 自動化測試 CI/CD | 高 | 3 小時 | 高 |

### 推薦實施順序

```
第 1 優先：系統儀表板 Dashboard
  • 實時顯示系統狀態
  • 快速故障診斷
  • 2026-11-13 預計完成

第 2 優先：API 文檔生成
  • Swagger/OpenAPI 集成
  • 自動從代碼生成
  • 2026-11-13 預計完成

第 3 優先：自動化測試 CI/CD
  • GitHub Actions 集成
  • 自動部署流程
  • 2026-11-14 預計完成

第 4 優先：WebSocket 實時通知
  • 替代 Long Polling
  • 更低延遲
  • 2026-11-15 預計完成
```

---

## 📊 整體進度報告

```
步驟 1：部署上線                ✅ 完成（30 分鐘）
步驟 2：功能擴展（4 項）        ✅ 完成（3 小時）
步驟 3：系統集成（4 項）        ✅ 完成（2.5 小時）
步驟 4：測試框架（5 層）        ✅ 完成（2.5 小時）
步驟 5：運維系統（5 個）        ✅ 完成（1.5 小時）
步驟 6：新功能規劃              ✅ 完成（規劃中）

總耗時：12 小時
推薦進度：
  Day 1：步驟 1-2（3.5 小時）
  Day 2：步驟 3-4（5 小時）
  Day 3：步驟 5-6（3.5 小時）
```

---

## 🎯 完成標準

### 步驟 1：部署上線
- ✅ 應用上線，可以訪問
- ✅ 數據庫已初始化
- ✅ PM2 進程正常

### 步驟 2：功能擴展
- ✅ 4 項功能全部實現
- ✅ 所有 API 可用
- ✅ 前端組件集成

### 步驟 3：系統集成
- ✅ 4 個系統已連接
- ✅ 數據正確同步
- ✅ 審計日誌完整

### 步驟 4：測試框架
- ✅ 覆蓋率 > 80%
- ✅ 所有測試通過
- ✅ CI/CD 已配置

### 步驟 5：運維系統
- ✅ 監控告警運行
- ✅ 備份自動執行
- ✅ 日誌正常記錄

### 步驟 6：新功能
- ✅ Dashboard 完成
- ✅ API 文檔完成
- ✅ CI/CD 流程完成

---

## 📞 需要幫助？

每個步驟都有詳細的文檔：
- 步驟 1：PHASE_A_DEPLOYMENT_GUIDE.md
- 步驟 2：PHASE_B_FEATURE_EXPANSION.md
- 步驟 3：PHASE_C_SYSTEM_INTEGRATION.md
- 步驟 4：PHASE_D_TESTING_QA.md
- 步驟 5：PHASE_E_OPERATIONS_SETUP.md
- 步驟 6：本文檔

---

**完整的 1→2→3→4→5→6 實施流程已準備完畢！** 🎉
