# 營運狀況報表 - 部署指令

**部署日期**: 2024-11-24  
**版本**: 1.0.0  
**分支**: `manual-production-only`  
**狀態**: ✅ 準備部署

---

## 🚀 快速部署

### 預覽環境部署 (推薦)

```bash
# 1. 確認所有更改已提交
git status
# 應該顯示: working tree clean

# 2. Push 分支到 GitHub
git push origin manual-production-only

# 3. Vercel 自動部署
# 檢查: https://vercel.com/[project-name]/deployments
# 預覽 URL: https://[project]-[pr-number].vercel.app

# 4. 訪問預覽環境
# https://[preview-url]/admin/operations-report
```

### 生產環境部署 (經過預覽驗證後)

```bash
# 1. 切換到 main 分支
git checkout main

# 2. Merge 或 cherry-pick 功能提交
git merge manual-production-only
# 或
git cherry-pick 30255f1 049d792 6eb6af5 ... (依序列出所有提交)

# 3. Push 到 main 分支
git push origin main

# 4. Vercel 自動部署到生產
# 檢查: https://vercel.com/[project-name]
# 生產 URL: https://[your-domain]/admin/operations-report
```

---

## ✅ 部署前檢查清單

### 代碼質量
- [x] TypeScript 編譯通過 (`npm run typecheck`)
- [x] ESLint 檢查通過
- [x] 所有測試通過 (`npm run test`)
- [x] 生產構建成功 (`npm run build`)
- [x] No console 錯誤或警告

### 功能驗證
- [x] 7 天報表加載正常
- [x] 30 天報表加載正常
- [x] 90 天報表加載正常
- [x] 自定義日期範圍正常
- [x] 所有圖表正確渲染
- [x] 指標卡片顯示正確值

### 導出功能
- [x] PDF 下載正常
- [x] CSV 導出正常
- [x] 列印功能正常
- [x] 文件名格式正確

### 響應式設計
- [x] 移動端佈局正確 (375px)
- [x] 平板端佈局正確 (768px)
- [x] 桌面端佈局正確 (1024px+)
- [x] 觸控交互正常
- [x] 列印樣式正確

### 安全性
- [x] 權限檢查已實施 (finance permission)
- [x] 敏感數據不暴露在客戶端
- [x] SQL 注入防護 (Prisma ORM)
- [x] XSS 防護 (React 轉義)
- [x] CSRF 防護 (Next.js 內置)

### 文檔完整性
- [x] README.md 已編寫
- [x] API.md 已編寫
- [x] PERFORMANCE.md 已編寫
- [x] DEPLOYMENT.md 已編寫
- [x] COMPLETION_REPORT.md 已編寫

---

## 📋 部署後驗證

### 1. 功能測試 (5-10 分鐘)

```bash
# 訪問應用
curl https://[deployed-url]/admin/operations-report

# 驗證頁面加載
curl -s https://[deployed-url]/admin/operations-report | grep -c "營運狀況報表"
# 應該輸出: 1

# 檢查 HTTP 狀態碼
curl -s -o /dev/null -w "%{http_code}" https://[deployed-url]/admin/operations-report
# 應該輸出: 200
```

### 2. 性能檢查 (5-10 分鐘)

在瀏覽器中訪問並打開 DevTools:

```
1. 打開 Console 標籤
   - 不應有紅色錯誤
   - 不應有黃色警告 (除非是第三方)

2. 打開 Network 標籤
   - 刷新頁面
   - 檢查加載時間 (應 < 2.5s LCP)
   - 檢查資源大小

3. 打開 Lighthouse 標籤
   - 運行分析
   - 性能分數 > 80
   - SEO 分數 > 90
```

### 3. 數據驗證 (5-10 分鐘)

```bash
# 測試 API 端點
curl "https://[deployed-url]/api/operations-metrics?from=2024-11-20&to=2024-11-30"

# 檢查響應結構
# 應包含:
# - bookingCompletion
# - courtUtilization
# - entries
# - doorAccess
# - timestamp
```

### 4. 導出測試 (5 分鐘)

在瀏覽器中:

1. 點擊 "下載 PDF" 按鈕
   - 檢查文件是否下載
   - 檢查文件名格式: `營運狀況報表_YYYY-MM-DD_YYYY-MM-DD.pdf`

2. 點擊 "導出 CSV" 按鈕
   - 檢查文件是否下載
   - 檢查文件名格式: `營運狀況報表_YYYY-MM-DD_YYYY-MM-DD.csv`

3. 按 Ctrl+P 或 Cmd+P 進行列印預覽
   - 檢查佈局正確
   - 檢查頁邊距
   - 檢查沒有多餘元素

### 5. 移動端測試 (5 分鐘)

在手機或平板上:

1. 訪問應用
2. 檢查按鈕可點擊 (> 44px)
3. 檢查文本可讀
4. 檢查沒有橫向滾動

---

## 🔄 回滾程序

如果部署出現問題:

### 快速回滾 (Vercel)

```bash
# 方式 1: 使用 Vercel CLI
vercel rollback

# 方式 2: 手動回滾
# 1. 在 Vercel 儀表板中選擇上一個成功的構建
# 2. 點擊 "Promote to Production"

# 方式 3: Revert 提交
git revert <failed-commit>
git push origin main
```

### 半小時內有問題立即:

1. **立即通知** — 運維和開發團隊
2. **啟動回滾** — 使用上述任何方式
3. **調查原因** — 檢查日誌和指標
4. **修復問題** — 在 `manual-production-only` 分支中
5. **重新部署** — 經過完整測試後

---

## 📊 部署後監控

### 關鍵指標

在 Vercel Analytics 和 Sentry 中監控:

```
1. Error Rate (應 < 1%)
2. Response Time (應 < 1.5s)
3. LCP (應 < 2.5s)
4. FID (應 < 100ms)
5. CLS (應 < 0.1)
```

### 日誌檢查

```bash
# Vercel 日誌
vercel logs

# Sentry 錯誤
vercel logs --level error

# 實時監控
# 訪問: https://vercel.com/[project]/monitoring
```

---

## 🎯 部署時間表

### 預覽環境部署
- **預計時間**: 2-3 分鐘 (Vercel 自動)
- **驗證時間**: 5-15 分鐘
- **完成**: 20-30 分鐘

### 生產環境部署
- **預計時間**: 2-3 分鐘 (Vercel 自動)
- **驗證時間**: 10-20 分鐘
- **完成**: 20-30 分鐘

### 建議部署時間
- **最佳**: 周二至周四, 10:00-16:00
- **避免**: 周末、晚上、假日
- **需要**: 有人值班進行監控

---

## 📞 支持聯繫

### 部署相關
- **Vercel 管理員**: [聯繫方式]
- **DevOps**: [聯繫方式]
- **SRE**: [聯繫方式]

### 技術支持
- **前端**: [聯繫方式]
- **後端**: [聯繫方式]
- **DBA**: [聯繫方式]

### 緊急聯繫
- **24/7 值班**: [電話]
- **Slack 緊急頻道**: #production-incidents

---

## 📝 部署記錄

| 日期 | 環境 | 版本 | 部署者 | 狀態 | 備註 |
|------|------|------|--------|------|------|
| | 預覽 | 1.0.0 | | | |
| | 生產 | 1.0.0 | | | |

---

## ✨ 完成後

部署完成並驗證成功後:

1. ✅ 更新 CHANGELOG
2. ✅ 標記 Release (GitHub)
3. ✅ 發送部署通知到 Slack
4. ✅ 更新狀態頁面
5. ✅ 存檔部署文檔

---

**準備好了嗎?** 🚀

請按照上述步驟進行部署。如有任何問題，請立即聯繫相應的支持團隊。

---

**部署檢查清單完成**: ✅  
**代碼審查**: ✅  
**測試覆蓋**: ✅  
**文檔完整**: ✅  

**部署狀態**: 🟢 **READY TO DEPLOY**
