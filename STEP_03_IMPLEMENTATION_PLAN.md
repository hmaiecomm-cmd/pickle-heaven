# STEP 03 — DUPR 前端 UI 集成 & API 補充 實裝計劃

**預計耗時**: 5-7 天  
**難度**: 中等  
**優先順序**: 後端 API → 前端 UI → 集成測試

---

## 📋 STEP 03 工作分解

### 第一階段：後端補充 API（1-2 天）

#### 1️⃣ GET /api/dupr/me — 查詢連結狀態

**文件**: `src/app/api/dupr/me/route.ts`

```typescript
// 功能: 查詢當前用戶的 DUPR 連結狀態
// 用途: 前端判斷是否已連結、顯示球員信息

// 請求
GET /api/dupr/me

// 成功回應 (已連結)
{
  "success": true,
  "linked": true,
  "data": {
    "duprPlayerId": "DUPR_12345",
    "playerName": "張三",
    "singlesRating": 3.25,
    "doublesRating": 3.40,
    "linkedAt": "2026-11-16T10:00:00Z",
    "ratingUpdatedAt": "2026-11-16T10:00:00Z"
  }
}

// 成功回應 (未連結)
{
  "success": true,
  "linked": false,
  "data": null
}

// 錯誤回應
{
  "success": false,
  "error": "未授權"
}
```

---

#### 2️⃣ DELETE /api/dupr/link — 解除連結

**文件**: `src/app/api/dupr/link/route.ts`

```typescript
// 功能: 解除用戶的 DUPR 帳號連結
// 用途: 用戶可以手動取消 DUPR 連結

// 請求
DELETE /api/dupr/link

// 成功回應
{
  "success": true,
  "message": "已解除 DUPR 帳號連結"
}

// 失敗回應
{
  "success": false,
  "error": "未連結任何 DUPR 帳號"
}
```

---

#### 3️⃣ POST /api/dupr/sync-ratings — 手動同步評級

**文件**: `src/app/api/dupr/sync-ratings/route.ts`

```typescript
// 功能: 手動從 DUPR 同步最新評級
// 用途: 用戶可以手動刷新評級（不等待自動同步）

// 請求
POST /api/dupr/sync-ratings

// 成功回應
{
  "success": true,
  "data": {
    "singlesRating": 3.30,
    "doublesRating": 3.45,
    "syncedAt": "2026-11-16T12:00:00Z"
  }
}

// 失敗回應
{
  "success": false,
  "error": "未連結 DUPR 帳號或同步失敗"
}
```

---

### 第二階段：前端 UI 組件（3-5 天）

#### 1️⃣ DUPR 連結卡片組件

**文件**: `src/components/dupr/dupr-link-card.tsx`

```typescript
// 顯示 DUPR 連結狀態
// Props:
//   - linked: boolean — 是否已連結
//   - playerData?: { duprPlayerId, playerName, singlesRating, doublesRating }
//   - onLinkClick: () => void — 點擊連結時
//   - onUnlinkClick: () => void — 點擊解除連結時
//   - isLoading?: boolean — 加載中

export function DuprLinkCard({ ... }) {
  return (
    <div className="rounded-xl surface p-6">
      {!linked ? (
        // 未連結狀態
        <div>
          <h3>DUPR 智慧賽事系統</h3>
          <p>連結您的 DUPR 帳號，查看評級與賽事記錄</p>
          <Button onClick={onLinkClick}>立即連結</Button>
        </div>
      ) : (
        // 已連結狀態
        <div>
          <h3>{playerData.playerName}</h3>
          <p>DUPR ID: {playerData.duprPlayerId}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted">單打評級</p>
              <p className="text-2xl">{playerData.singlesRating}</p>
            </div>
            <div>
              <p className="text-muted">雙打評級</p>
              <p className="text-2xl">{playerData.doublesRating}</p>
            </div>
          </div>
          <Button variant="destructive" onClick={onUnlinkClick}>
            解除連結
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

#### 2️⃣ OAuth 授權對話框

**文件**: `src/components/dupr/dupr-auth-dialog.tsx`

```typescript
// 處理 OAuth 流程的對話框
// Props:
//   - open: boolean
//   - onOpenChange: (open: boolean) => void
//   - onSuccess: () => void

export function DuprAuthDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async () => {
    setLoading(true)
    try {
      // 1. 調用 /api/auth/dupr/authorize 取得授權 URL
      const res = await fetch('/api/auth/dupr/authorize', {
        method: 'POST',
      })
      const { authUrl } = await res.json()

      // 2. 打開新視窗導向授權頁面
      const popup = window.open(authUrl, 'dupr-auth', 'width=500,height=600')

      // 3. 監聽 callback 回傳（通過 postMessage）
      window.addEventListener('message', (e) => {
        if (e.data.type === 'dupr-auth-success') {
          onOpenChange(false)
          onSuccess()
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>連結 DUPR 帳號</DialogTitle>
        </DialogHeader>
        <p>點擊下方按鈕以 DUPR 帳號授權連結</p>
        <Button onClick={handleAuth} disabled={loading}>
          {loading ? '授權中...' : '前往授權'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

---

#### 3️⃣ 成功頁面

**文件**: `src/app/dupr/link-success/page.tsx`

```typescript
// 連結成功頁面
// URL: /dupr/link-success?playerId=...&playerName=...&singlesRating=...&doublesRating=...

export default function DuprLinkSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const playerName = searchParams.get('playerName')
  const singlesRating = searchParams.get('singlesRating')
  const doublesRating = searchParams.get('doublesRating')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CheckCircle className="text-green-600" />
            連結成功！
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted">球員名稱</p>
            <p className="text-lg font-semibold">{playerName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted text-sm">單打評級</p>
              <p className="text-2xl font-bold">{singlesRating}</p>
            </div>
            <div>
              <p className="text-muted text-sm">雙打評級</p>
              <p className="text-2xl font-bold">{doublesRating}</p>
            </div>
          </div>
          <Button className="w-full" onClick={() => router.push('/account?tab=profile')}>
            返回帳戶
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

#### 4️⃣ 失敗頁面

**文件**: `src/app/dupr/link-error/page.tsx`

```typescript
// 連結失敗頁面
// URL: /dupr/link-error?error=...&description=...

export default function DuprLinkErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const error = searchParams.get('error')
  const description = searchParams.get('description')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <AlertCircle className="text-red-600" />
            連結失敗
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted">錯誤</p>
            <p className="text-base">{error || '未知錯誤'}</p>
          </div>
          {description && (
            <div>
              <p className="text-muted">詳情</p>
              <p className="text-sm">{description}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => router.back()}>
              返回
            </Button>
            <Button className="flex-1" onClick={() => router.push('/account?tab=profile')}>
              返回帳戶
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

#### 5️⃣ 整合到帳戶頁面

**修改**: `src/app/account/account-tabs.tsx`

```typescript
// 在 ACCOUNT_TABS 中新增 DUPR 選項
import { Trophy } from 'lucide-react'

export const ACCOUNT_TABS: { key: AccountTab; label: string; icon: typeof CalendarCheck }[] = [
  { key: 'bookings', label: '我的預約', icon: CalendarCheck },
  { key: 'activities', label: '球敘／活動', icon: Users },
  { key: 'orders', label: '我的訂單', icon: Receipt },
  { key: 'points', label: '點數／票券', icon: Coins },
  { key: 'dupr', label: 'DUPR', icon: Trophy },  // ← 新增
  { key: 'profile', label: '個人資料', icon: UserRound },
]
```

**新增**: `src/app/account/dupr/page.tsx`

```typescript
// DUPR 帳號管理頁面
'use client'

import { useEffect, useState } from 'react'
import { DuprLinkCard } from '@/components/dupr/dupr-link-card'
import { DuprAuthDialog } from '@/components/dupr/dupr-auth-dialog'

export default function DuprPage() {
  const [linked, setLinked] = useState(false)
  const [playerData, setPlayerData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 查詢連結狀態
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/dupr/me')
      const { linked, data } = await res.json()
      setLinked(linked)
      setPlayerData(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleUnlink = async () => {
    if (!confirm('確定要解除 DUPR 帳號連結嗎？')) return

    const res = await fetch('/api/dupr/link', { method: 'DELETE' })
    if (res.ok) {
      setLinked(false)
      setPlayerData(null)
      alert('已解除連結')
    }
  }

  const handleSuccess = () => {
    fetchStatus()
  }

  if (loading) return <div>加載中...</div>

  return (
    <div className="space-y-4">
      <DuprLinkCard
        linked={linked}
        playerData={playerData}
        onLinkClick={() => setDialogOpen(true)}
        onUnlinkClick={handleUnlink}
      />

      <DuprAuthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
```

---

### 第三階段：集成測試（2-3 天）

#### 1️⃣ API 路由測試

**文件**: `src/app/api/dupr/__tests__/api.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('DUPR API Endpoints', () => {
  describe('GET /api/dupr/me', () => {
    it('應該返回已連結用戶的資訊', async () => {
      // 使用測試用戶
      const res = await fetch('/api/dupr/me', {
        headers: {
          'Cookie': 'session=test-user-123'
        }
      })
      
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.linked).toBe(true)
      expect(data.data).toHaveProperty('duprPlayerId')
      expect(data.data).toHaveProperty('playerName')
      expect(data.data).toHaveProperty('singlesRating')
      expect(data.data).toHaveProperty('doublesRating')
    })

    it('應該返回未連結狀態', async () => {
      const res = await fetch('/api/dupr/me', {
        headers: {
          'Cookie': 'session=new-user-456'
        }
      })
      
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.linked).toBe(false)
      expect(data.data).toBeNull()
    })
  })

  describe('DELETE /api/dupr/link', () => {
    it('應該解除已連結的帳號', async () => {
      const res = await fetch('/api/dupr/link', {
        method: 'DELETE',
        headers: {
          'Cookie': 'session=test-user-123'
        }
      })
      
      const data = await res.json()
      expect(data.success).toBe(true)
      
      // 驗證確實已解除
      const checkRes = await fetch('/api/dupr/me', {
        headers: {
          'Cookie': 'session=test-user-123'
        }
      })
      const checkData = await checkRes.json()
      expect(checkData.linked).toBe(false)
    })
  })

  describe('POST /api/dupr/sync-ratings', () => {
    it('應該同步最新評級', async () => {
      const res = await fetch('/api/dupr/sync-ratings', {
        method: 'POST',
        headers: {
          'Cookie': 'session=test-user-123'
        }
      })
      
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('singlesRating')
      expect(data.data).toHaveProperty('doublesRating')
      expect(data.data).toHaveProperty('syncedAt')
    })
  })
})
```

---

#### 2️⃣ E2E 流程測試

**文件**: `src/app/account/dupr/__tests__/e2e.test.ts`

```typescript
// E2E 測試：完整的連結、展示、解除連結流程

describe('DUPR 完整流程', () => {
  it('應該完成 OAuth 授權流程', async () => {
    // 1. 訪問帳戶頁面
    // 2. 點擊連結按鈕
    // 3. 授權對話框打開
    // 4. 重定向到 /dupr/link-success
    // 5. 顯示球員資訊
    // 6. 返回帳戶頁面
    // 7. 驗證已連結狀態
  })

  it('應該處理連結失敗', async () => {
    // 1. 模擬 OAuth 失敗
    // 2. 重定向到 /dupr/link-error
    // 3. 顯示錯誤信息
    // 4. 用戶可以重試
  })

  it('應該允許用戶解除連結', async () => {
    // 1. 用戶已連結
    // 2. 點擊解除連結按鈕
    // 3. 確認對話框
    // 4. 連結已解除
    // 5. UI 更新為未連結狀態
  })
})
```

---

## 🚀 實裝步驟（按順序）

### Week 1 - 後端 API（Day 1-2）

```bash
# Step 1: 實裝 GET /api/dupr/me
# Step 2: 實裝 DELETE /api/dupr/link
# Step 3: 實裝 POST /api/dupr/sync-ratings
# Step 4: 運行 API 測試
# Step 5: Postman 手動測試
```

### Week 1 - 前端 UI（Day 3-5）

```bash
# Step 6: 新增 DUPR 連結卡片組件
# Step 7: 新增 OAuth 授權對話框
# Step 8: 建立成功/失敗頁面
# Step 9: 整合到帳戶頁面
# Step 10: UI 視覺測試
```

### Week 2 - 集成測試（Day 1-3）

```bash
# Step 11: 寫 API 集成測試
# Step 12: 寫 E2E 流程測試
# Step 13: 全流程手動測試
# Step 14: 修復 bugs
# Step 15: STEP 03 完成驗收
```

---

## 📊 代碼位置對應表

| 功能 | 文件位置 | 說明 |
|------|---------|------|
| **後端** | | |
| 查詢狀態 | `src/app/api/dupr/me/route.ts` | 新建 |
| 解除連結 | `src/app/api/dupr/link/route.ts` | 新建 |
| 同步評級 | `src/app/api/dupr/sync-ratings/route.ts` | 新建 |
| **前端** | | |
| 卡片組件 | `src/components/dupr/dupr-link-card.tsx` | 新建 |
| 授權對話框 | `src/components/dupr/dupr-auth-dialog.tsx` | 新建 |
| 成功頁面 | `src/app/dupr/link-success/page.tsx` | 新建 |
| 失敗頁面 | `src/app/dupr/link-error/page.tsx` | 新建 |
| 管理頁面 | `src/app/account/dupr/page.tsx` | 新建 |
| 帳戶導航 | `src/app/account/account-tabs.tsx` | 修改 |
| **測試** | | |
| API 測試 | `src/app/api/dupr/__tests__/api.test.ts` | 新建 |
| E2E 測試 | `src/app/account/dupr/__tests__/e2e.test.ts` | 新建 |

---

## 🔄 前端 & 後端協作流程

```
前端团队                          後端團隊
     |                               |
     | ← STEP 02 後端完成 ✅         |
     |                               |
     | ← 補充 API 規格              |
     |   (GET /api/dupr/me)          |
     |                               |
     |                        實裝 GET /api/dupr/me
     |                        實裝 DELETE /api/dupr/link  
     |                        實裝 POST /api/dupr/sync-ratings
     |                        API 測試完成 ✅ |
     |                               |
開始設計 UI ────────────────────→ 準備 Mock 數據
製作成功/失敗頁面 │
              │
              ↓
  集成 OAuth 流程
  連接前端 & 後端
              │
              ↓
        E2E 測試 ✅
              │
              ↓
      STEP 03 完成 ✅
```

---

## 🧪 本地測試 Checklist

### 後端測試

```bash
# ✅ 1. TypeScript 編譯
npm run typecheck

# ✅ 2. 構建檢查
npm run build

# ✅ 3. 啟動開發伺服器
npm run dev

# ✅ 4. Postman 測試 API
#    POST /api/auth/dupr/authorize → 取得授權 URL
#    GET /api/dupr/me → 查詢連結狀態
#    DELETE /api/dupr/link → 解除連結
#    POST /api/dupr/sync-ratings → 同步評級
```

### 前端測試

```bash
# ✅ 1. 訪問帳戶頁面
#    http://localhost:3000/account?tab=dupr

# ✅ 2. 測試連結流程
#    點擊「連結」按鈕
#    授權對話框打開
#    重定向到 /dupr/link-success

# ✅ 3. 測試解除連結
#    點擊「解除連結」按鈕
#    確認對話框
#    UI 更新為未連結狀態

# ✅ 4. 測試評級同步
#    點擊「刷新評級」按鈕
#    等待同步完成
#    評級更新
```

---

## 🎯 成功標誌

STEP 03 完成當以下所有條件都滿足時：

- ✅ TypeScript 編譯無錯誤
- ✅ 所有 API 端點可用
- ✅ 帳戶頁面顯示 DUPR 選項
- ✅ 可以完整流程連結和解除連結
- ✅ 評級正確顯示
- ✅ E2E 測試通過
- ✅ 沒有 console 錯誤

---

## 📞 常見問題

### Q: 如何測試 OAuth 流程在本地？

**A**: 使用 Mock Adapter（已準備）：
1. 確保 `DUPR_API_URL="https://mock.dupr.local"`
2. 調用 `/api/auth/dupr/authorize`
3. 會返回 Mock 授權 URL
4. 模擬 callback 參數

### Q: 如何處理 OAuth popup 窗口？

**A**: 兩種方式：
1. **Popup 方式**：新開窗口 → OAuth 完成 → 回調
2. **重定向方式**：直接重定向 → OAuth 完成 → 回到 callback 端點

建議用 popup + postMessage 通信。

### Q: 如何跨瀏覽器測試？

**A**: 使用 Playwright 或 Cypress：
```bash
npm install -D playwright
npx playwright test
```

### Q: 數據安全嗎？

**A**: 是的：
- Token 已 AES-256-GCM 加密
- CSRF state 驗證
- getSessionUser() 身份驗證
- 完整 API 日誌記錄

---

## ✅ STEP 02 → STEP 03 清單

確保以下都已完成：

- ✅ STEP 02 已提交（commit e1a5f5d）
- ✅ Prisma Client 已生成
- ✅ 加密工具已實裝
- ✅ 服務層已實裝
- ✅ OAuth 端點已實裝
- ✅ 環境變數已設置
- ✅ .env 中有 DUPR_ENCRYPTION_KEY

**現在您可以開始 STEP 03！** 🚀

---

**下一步**: 選擇 Option 1 / 2 / 3 開始實裝。我可以幫您逐個實裝每個文件。

想要我現在開始實裝哪個？
- 🔌 後端 API（getMe, deleteLink, syncRatings）
- 🎨 前端組件（卡片、對話框、頁面）
- 🧪 測試套件

---

**簽署**: Claude Haiku 4.5  
**日期**: 2026-11-16
