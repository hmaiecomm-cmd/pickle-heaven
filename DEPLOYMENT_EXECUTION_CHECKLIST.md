# 🚀 部署執行檢查清單

**開始時間：** 2026-11-12  
**預計完成：** 30 分鐘  
**狀態：** ⏳ 執行中  

---

## ✅ 部署前準備（5 分鐘）

- [ ] **確認環境**
  ```bash
  node -v  # 應該 >= 18
  npm -v   # 應該 >= 9
  git -v   # 應該已安裝
  ```

- [ ] **確認代碼**
  ```bash
  git status  # 應該沒有未提交的關鍵文件
  git log --oneline -1  # 查看最新提交
  ```

- [ ] **檢查存儲空間**
  ```bash
  # 確保有至少 1GB 可用空間
  df -h /  # Linux/macOS
  # 或在 Windows 中檢查磁碟空間
  ```

---

## 🔧 第 1 步：配置環境變數（5 分鐘）

### Windows 用戶：
```bash
# 複製配置範本
copy .env.example .env.production

# 用記事本編輯
notepad .env.production
```

### Linux/macOS 用戶：
```bash
# 複製配置範本
cp .env.example .env.production

# 用編輯器編輯
nano .env.production
# 或
vi .env.production
```

### ✅ 必須填寫的項目：

```
1. ADMIN_JWT_SECRET
   生成方法：
   openssl rand -hex 32
   或
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

2. LINE_CHANNEL_ID
   位置：LINE Developers Console > Channel Settings

3. LINE_CHANNEL_SECRET
   位置：LINE Developers Console > Channel Settings

4. RESEND_API_KEY
   位置：https://resend.com > API Keys

5. DATABASE_URL
   範例：
   - PostgreSQL: postgresql://user:password@localhost:5432/pickle_heaven
   - SQLite: file:./prisma/dev.db
   - Turso: libsql://your-db.turso.io?authToken=your-token

6. NEXT_PUBLIC_APP_URL
   範例：https://your-domain.com
   （本地測試可用 http://localhost:3000）
```

- [ ] 所有必需項目已填寫
- [ ] 文件已保存

---

## 🚀 第 2 步：執行部署腳本（25 分鐘）

### Windows 用戶：
```bash
deploy.bat
```

### Linux/macOS 用戶：
```bash
bash deploy.sh
```

### 腳本會依序執行：

- [ ] **環境驗證** (2 分鐘)
  - 檢查 Node.js 版本 ✅
  - 檢查 npm 版本 ✅
  - 驗證 .env.production ✅

- [ ] **數據庫遷移** (3 分鐘)
  - 執行 Prisma Migration ✅
  - 生成 Prisma Client ✅

- [ ] **依賴安裝** (5 分鐘)
  - npm install --production ✅

- [ ] **應用構建** (10 分鐘)
  - npm run build ✅
  - 驗證 .next 目錄 ✅

- [ ] **PM2 配置** (2 分鐘)
  - 安裝 PM2 ✅
  - 啟動應用進程 ✅
  - 設置開機自啟 ✅

- [ ] **上線驗證** (3 分鐘)
  - 檢查進程狀態 ✅
  - 查看日誌 ✅
  - 測試 API ✅

---

## ✓ 部署完成後驗證（3 分鐘）

### 檢查進程狀態：
```bash
pm2 status
# 應該看到 pickle-heaven 進程為 online
```

- [ ] PM2 進程狀態: **online**

### 查看應用日誌：
```bash
pm2 logs pickle-heaven --lines 20
# 應該看到應用啟動日誌，沒有紅色錯誤
```

- [ ] 日誌狀態: **無錯誤**

### 測試 API 端點：
```bash
# Windows 用戶
curl http://localhost:3000/admin/login

# 應該返回 HTML 頁面或 301 重定向
```

- [ ] API 狀態: **可訪問 (HTTP 200/301)**

### 驗證應用資源：
```bash
pm2 monit
# 檢查 CPU 和內存使用
# 應該為 CPU < 50%, 內存 < 300MB
```

- [ ] CPU 使用: **< 50%**
- [ ] 內存使用: **< 300MB**

### 在瀏覽器中訪問：
```
http://localhost:3000/admin/login
```

- [ ] 頁面載入成功
- [ ] 見到登入表單
- [ ] LINE Login 按鈕顯示

---

## 🎯 部署完成標誌

✅ **部署成功的所有指標：**

- [x] PM2 進程在線
- [x] 應用可訪問
- [x] 日誌無錯誤
- [x] CPU < 50%
- [x] 內存 < 300MB
- [x] 登入頁面可見
- [x] 數據庫已初始化

---

## 🆘 故障排除

### 如果某一步失敗：

1. **檢查錯誤日誌**
   ```bash
   pm2 logs pickle-heaven
   ```

2. **查看詳細輸出**
   ```bash
   pm2 logs pickle-heaven --err
   ```

3. **重啟應用**
   ```bash
   pm2 restart pickle-heaven
   ```

4. **查看常見問題**
   參考：`DEPLOYMENT_QUICK_START.md` 中的故障排除部分

5. **獲取幫助**
   檢查：
   - OPERATIONS_GUIDE.md
   - BACKEND_INTEGRATION_GUIDE.md
   - 實施步驟文檔

---

## 📊 最終狀態

部署完成後，您將有：

- ✅ 運行中的 Next.js 應用
- ✅ 初始化的數據庫（2 個 migration）
- ✅ 後台管理系統 v1.0.0
- ✅ 完整的認證系統（LINE OAuth + 本地登入）
- ✅ PM2 進程管理
- ✅ 開機自啟配置

---

## 🎯 下一步

部署完成後可以：

1. **測試功能**（10 分鐘）
   - 訪問登入頁面
   - 測試 LINE Login
   - 測試本地登入

2. **繼續開發**（3.5 小時）
   - 實施步驟 2 的其他 3 項功能
   - 或進行步驟 3-6

3. **優化環境**
   - 配置 SSL 證書
   - 設置反向代理
   - 配置監控告警

---

**開始部署！按照檢查清單逐步執行。** 🚀
