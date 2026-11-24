# 營運狀況報表部署清單

## 預部署檢查

### 代碼質量
- [x] TypeScript 編譯成功 (`npm run typecheck`)
- [x] ESLint 檢查通過
- [x] Next.js 生產構建成功 (`npm run build`)
- [x] 無 console 錯誤或警告
- [x] 測試覆蓋率達到目標

### 功能驗證
- [ ] 7天報表加載正常
- [ ] 30天報表加載正常
- [ ] 90天報表加載正常
- [ ] 自定義日期範圍功能正常
- [ ] 所有圖表正確渲染
- [ ] 所有指標卡片顯示正確值

### 數據驗證
- [ ] 預約完成率計算正確
- [ ] 場地使用率計算正確
- [ ] 進場人次統計正確
- [ ] 門禁開門成功率正確
- [ ] 異常提示正確生成

### 導出功能
- [ ] PDF 下載功能正常
- [ ] CSV 導出功能正常
- [ ] 列印功能正常
- [ ] 日期範圍在文件名中正確

### 響應式設計
- [ ] 移動端 (375px) 佈局正確
- [ ] 平板端 (768px) 佈局正確
- [ ] 桌面端 (1024px+) 佈局正確
- [ ] 觸控交互正常
- [ ] 列印樣式正確

### 性能指標
- [ ] 首次加載時間 < 2.5s (LCP)
- [ ] 首次輸入延遲 < 100ms (FID)
- [ ] 累積佈局移位 < 0.1 (CLS)
- [ ] 90天報表查詢 < 3s

### 安全性
- [x] 權限檢查已實現 (finance permission)
- [x] SQL 注入防護 (Prisma ORM)
- [x] XSS 防護 (React 自動轉義)
- [x] CSRF 防護 (Next.js 內置)
- [ ] API 速率限制已配置
- [ ] 敏感數據未暴露在客戶端

### 可訪問性
- [ ] 色彩對比度達到 WCAG AA 標準
- [ ] 鍵盤導航正常
- [ ] 屏幕閱讀器兼容
- [ ] ARIA 標籤已正確使用

## 部署步驟

### 1. 預覽環境部署 (Vercel Preview)

```bash
# Push to GitHub
git push origin manual-production-only

# Vercel 自動部署預覽
# 檢查: https://vercel.com/[project-name]/deployments
```

### 2. 生產環境部署 (Vercel Production)

```bash
# 切換到 main 分支
git checkout main

# Cherry-pick 或 merge 功能分支
git cherry-pick <commit-hash>
# 或
git merge manual-production-only

# Push to main (觸發生產部署)
git push origin main
```

### 3. 驗證部署

```bash
# 預覽環境測試
curl https://[preview-url]/admin/operations-report

# 檢查狀態碼和響應時間
curl -w "@curl-format.txt" -o /dev/null -s https://[preview-url]/admin/operations-report
```

## 部署後驗證

### 1. 功能測試

```bash
# 測試基本頁面加載
curl -s https://[deployed-url]/admin/operations-report | grep -c "營運狀況報表"

# 測試 API 端點
curl https://[deployed-url]/api/operations-metrics?from=2024-11-20&to=2024-11-30
```

### 2. 性能監控

- 檢查 Vercel Analytics 儀表板
- 監控 Core Web Vitals
- 檢查錯誤率和異常

### 3. 日誌檢查

```bash
# 檢查 Vercel 日誌
vercel logs

# 檢查錯誤
vercel logs --level error
```

## 回滾程序

如果部署出現問題：

```bash
# 1. 立即回滾到上一個版本
vercel rollback

# 2. 或者 revert commit
git revert <failed-commit>
git push origin main

# 3. 檢查回滾狀態
vercel deployments
```

## 監控配置

### Sentry 配置

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Replay({ maskAllText: true }),
  ],
})
```

### 告警設置

| 指標 | 閾值 | 動作 |
|------|------|------|
| Error Rate | > 1% | 發送 Slack 告警 |
| LCP | > 3s | 發送 Slack 告警 |
| Query Time | > 5s | 發送 Slack 告警 |
| Failure Rate | > 5% | 頁面告警 + Slack |

## 版本管理

### 語義化版本

- Major (1.0.0): 破壞性變更
- Minor (0.1.0): 新功能
- Patch (0.0.1): 錯誤修復

當前版本: **1.0.0** (Initial Release)

## 文檔

- [架構文檔](./ARCHITECTURE.md)
- [性能優化](./PERFORMANCE.md)
- [API 文檔](./API.md)
- [常見問題](./FAQ.md)

## 支持聯繫

- 開發團隊: dev@example.com
- 運維團隊: ops@example.com
- 緊急支持: 24/7 值班電話

## 部署檢查清單完成

部署日期: ___________
部署者: ___________
驗證者: ___________
簽名: ___________

---

**注意**: 完成所有檢查項目後，才能將代碼部署到生產環境。
