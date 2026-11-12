# 📂 根目錄檔案整理計劃

**執行日期**：2026-11-12  
**目標**：整理 60+ 個散落在根目錄的檔案到適當的資料夾

---

## 📋 整理方案

### 1️⃣ **配置檔案** → `/config/` 或保留根目錄

```
保留在根目錄（項目配置）：
├─ package.json              (NPM 依賴)
├─ package-lock.json         (依賴鎖定)
├─ next.config.mjs           (Next.js 配置)
├─ tsconfig.json             (TypeScript 配置)
├─ postcss.config.mjs         (PostCSS 配置)
├─ tailwind.config.ts        (Tailwind 配置)
├─ vercel.json               (Vercel 部署配置)
├─ .gitignore                (Git 忽略列表)
├─ .vercelignore             (Vercel 忽略列表)
├─ .env.example              (環境變數示例)
├─ README.md                 (項目主文檔)
└─ skill.md                  (Skill 定義)

移動到 `/config/` 或 `/env/`（環境配置）：
├─ .env                      → /config/.env
├─ .env.local                → /config/.env.local
└─ .env.bak-before-turso     → /config/.env.bak-before-turso
```

### 2️⃣ **Raspberry Pi & 電力控制** → `/iot/controllers/PowerController/docs/`

```
移動文件：
├─ RASPBERRY_PI_SDK_PLAN.md
├─ RASPBERRY_PI_SDK_IMPLEMENTATION_PLAN.md
├─ HARDWARE_INTEGRATION_GUIDE.md
├─ PROJECT_TIMELINE_AND_MILESTONES.md
├─ CONTROL_SYSTEM_IMPLEMENTATION_GUIDE.md
├─ CONTROL_SYSTEM_PHASE1.md
├─ CONTROL_SYSTEM_PHASE2_COMPLETED.md
├─ CONTROL_SYSTEM_PHASE3_COMPLETED.md
├─ CONTROL_SYSTEM_PHASE4_COMPLETED.md
├─ QUICK_START_CONTROL_SYSTEM.md
└─ IMPLEMENTATION_SUMMARY.md
```

### 3️⃣ **NVR & 攝影機監控** → `/iot/controllers/CameraController/docs/`

```
移動文件：
├─ NVR_INTEGRATION_TECHNICAL_SPECIFICATION.md
└─ NVR_INTEGRATION_IMPLEMENTATION_PLAN.md
```

### 4️⃣ **門禁系統** → `/iot/controllers/DoorController/docs/`

```
移動文件：
├─ DOOR_ACCESS_PHASE6_IMPLEMENTATION_PLAN.md
├─ DOOR_ACCESS_SYSTEM.md
└─ PHASE6_PROGRESS_SUMMARY.md
```

### 5️⃣ **LINE 通知系統** → `/integrations/line/` 或 `/docs/line/`

```
新建資料夾：/integrations/line/
移動文件：
├─ LINE_INTEGRATION_GUIDE.md
├─ LINE_INTEGRATION_DEMO.html
├─ LINE_DEVELOPERS_SETUP.md
├─ LINE_CONFIG_CHECKLIST.md
├─ LINE_NOTIFICATION_SUMMARY.md
└─ LINE_NOTIFICATION_TEST.md

新建資料夾：/docs/login/
移動文件：
├─ LOGIN_FLOW_TEST_GUIDE.md
├─ REMOTE_CONTROL_WATCHDOG_SETUP.md
└─ REMOTE_CONTROL_WATCHDOG_QUICK_START.md
```

### 6️⃣ **預約與退款系統** → `/booking/` 或 `/features/booking/`

```
新建資料夾：/booking/docs/
移動文件：
└─ BOOKING_TERMS_IMPLEMENTATION_PLAN.md
```

### 7️⃣ **API 文檔** → `/api/docs/`

```
新建資料夾：/api/docs/
移動文件：
└─ openapi.yaml
```

### 8️⃣ **項目管理與報告** → `/docs/reports/` 或 `/docs/progress/`

```
新建資料夾：/docs/reports/
移動文件：
├─ PROJECT_ROADMAP_2026.md
├─ PROJECT_COMPLETION_REPORT.md
├─ PROJECT_COMPLETION_SUMMARY.md
├─ PROJECT_HANDOVER_CHECKLIST.md
├─ COMPLETE_SYSTEM_DELIVERY.md
├─ WEEK_2_PROGRESS.md
├─ WEEK_3_COMPLETION.md
├─ W35_PROGRESS_REPORT.md
└─ QUICK_REFERENCE_CARD.md
```

### 9️⃣ **部署與生產** → `/docs/deployment/`

```
新建資料夾：/docs/deployment/
移動文件：
├─ PRODUCTION_DEPLOYMENT_CHECKLIST.md
├─ DEPLOYMENT_STATUS.md
└─ CLAUDE_CODE_PROCESS_WATCHDOG_SETUP.md
```

### 🔟 **測試與模擬** → `/docs/testing/`

```
新建資料夾：/docs/testing/
移動文件：
└─ SIMULATION_TEST_PLAN.md
```

### 1️⃣1️⃣ **數據與其他** → `/data/`

```
新建資料夾：/data/
移動文件：
├─ 預約_規範_模板_v1.xlsx
├─ Q&A_內含LINE通知500句_文字範例.xlsx
├─ Q&A_內含LINE通知500句.xlsx
└─ *.html 數據文件
└─ W35_完成報告.docx
```

---

## ✅ 執行步驟

### Step 1: 創建資料夾結構
```powershell
New-Item -ItemType Directory -Path "config" -Force
New-Item -ItemType Directory -Path "api/docs" -Force
New-Item -ItemType Directory -Path "booking/docs" -Force
New-Item -ItemType Directory -Path "data" -Force
New-Item -ItemType Directory -Path "docs/reports" -Force
New-Item -ItemType Directory -Path "docs/deployment" -Force
New-Item -ItemType Directory -Path "docs/testing" -Force
New-Item -ItemType Directory -Path "docs/login" -Force
New-Item -ItemType Directory -Path "integrations/line" -Force
New-Item -ItemType Directory -Path "iot/controllers/CameraController/docs" -Force
New-Item -ItemType Directory -Path "iot/controllers/PowerController/docs" -Force
New-Item -ItemType Directory -Path "iot/controllers/DoorController/docs" -Force
New-Item -ItemType Directory -Path "archive" -Force
```

### Step 2: 開始移動檔案

我會幫你執行實際的檔案移動。讓我先掃描根目錄，確認所有的檔案。

---

**預計時間**：10-15 分鐘  
**難度**：簡單  
**風險**：極低（複製操作可逆）
