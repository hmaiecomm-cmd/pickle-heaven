# LINE 整合完整指南（顧好 AI 智慧場館平台）

## 概述
你的項目已有 LINE 基礎設施，但需要完成三項核心任務：
1. ✅ **入口、登入與訊息流程整合** — 已有 LIFF 框架，需補全實現
2. 🧪 **測試 LINE 連結與身分流程** — 端對端測試
3. 📋 **服務條款更新與用戶同意機制** — 新增 UI 與 DB 追蹤

---

## 任務 1️⃣ 規劃與串接 LINE 入口、登入與訊息流程

### 1.1 了解現有架構

你的項目已有：
- ✅ LINE LIFF SDK（`@line/liff: ^2.24.0`）
- ✅ LINE Login 驗證（`src/lib/line.ts` 中的 `verifyLineIdToken`）
- ✅ LINE Messaging API（推播訊息、Flex Message）
- ✅ 用戶資料模型（`prisma/schema.prisma` 的 `User` 表，含 `lineUserId`）
- ✅ 後台認證系統（`src/lib/admin-auth.ts`）

**缺少項目：**
- ❌ LIFF 初始化與環境檢測
- ❌ 用戶首次登入流程（登入 → 同意 → 進入應用）
- ❌ 清晰的入口頁面（區分 LINE MINI App vs 桌機）
- ❌ 服務條款版本追蹤與同意記錄

### 1.2 分步實現：建立 LIFF 初始化與登入流程

#### 步驟 1：設定環境變數

編輯 `.env.local`，補充：
```env
# LINE MINI App LIFF 設定（見 LINE Developers）
NEXT_PUBLIC_LIFF_ID=your-liff-id
NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID=your-channel-id
LINE_LOGIN_CHANNEL_SECRET=your-secret
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=your-messaging-token

# 應用 URL（用於生成深連結與回調）
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### 步驟 2：建立 LIFF 初始化 Hook（`src/hooks/useLiff.ts`）

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import liff from '@line/liff'

export interface LiffUser {
  lineUserId: string
  displayName: string
  pictureUrl: string | null
}

export function useLiff() {
  const [initialized, setInitialized] = useState(false)
  const [isInLiff, setIsInLiff] = useState(false)
  const [user, setUser] = useState<LiffUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) {
          throw new Error('NEXT_PUBLIC_LIFF_ID 未設定')
        }

        await liff.init({ liffId })
        
        // 檢查是否在 LINE 內開啟
        setIsInLiff(liff.isInClient())

        // 若未登入且在 LINE 內，重導至 LINE Login
        if (!liff.isLoggedIn() && liff.isInClient()) {
          liff.login({ redirectUri: window.location.href })
          return
        }

        // 取得 ID Token（LINE Login 憑證）
        if (liff.isLoggedIn()) {
          const idToken = liff.getIDToken()
          if (idToken) {
            // 由後端驗證並建立 session
            const profile = await fetch('/api/auth/line/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            }).then((res) => {
              if (!res.ok) throw new Error(`驗證失敗：${res.statusText}`)
              return res.json()
            })

            setUser(profile)
          }
        }

        setInitialized(true)
      } catch (err) {
        console.error('[LIFF] 初始化失敗', err)
        setError(err instanceof Error ? err.message : '初始化失敗')
        setInitialized(true)
      }
    }

    init()
  }, [])

  return { initialized, isInLiff, user, error }
}
```

#### 步驟 3：建立後端認證端點（`src/app/api/auth/line/verify/route.ts`）

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyLineIdToken } from '@/lib/line'
import { db } from '@/lib/db'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'

const SESSION_HOURS = 24
const SESSION_COOKIE = 'ph_session'

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('缺少有效的 SESSION_SECRET')
  }
  return new TextEncoder().encode(s)
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) {
      return NextResponse.json({ error: '缺少 idToken' }, { status: 400 })
    }

    // 由伺服器驗證 ID Token
    const profile = await verifyLineIdToken(idToken)

    // 查找或建立用戶
    let user = await db.user.findUnique({
      where: { lineUserId: profile.lineUserId },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          lineUserId: profile.lineUserId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          email: profile.email,
        },
      })
    } else {
      // 更新現有用戶信息（名稱、頭像可能改變）
      user = await db.user.update({
        where: { id: user.id },
        data: {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          email: profile.email || user.email,
          updatedAt: new Date(),
        },
      })
    }

    // 建立 JWT Session Token
    const token = await new SignJWT({
      sub: user.id,
      lineUserId: user.lineUserId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(secret())

    // 設定 HttpOnly Cookie
    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    })

    return NextResponse.json({
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
    })
  } catch (err) {
    console.error('[auth/line/verify]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '驗證失敗' },
      { status: 401 }
    )
  }
}
```

#### 步驟 4：建立登入頁面（`src/app/login/page.tsx`）

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/hooks/useLiff'

export default function LoginPage() {
  const router = useRouter()
  const { initialized, isInLiff, user, error } = useLiff()

  useEffect(() => {
    if (initialized && user) {
      // 用戶已登入，導向預約頁
      router.replace('/booking')
    }
  }, [initialized, user, router])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">初始化中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 p-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-red-700 mb-2">登入出錯</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            請確認已將本應用加入 LINE 官方帳號的好友
          </p>
        </div>
      </div>
    )
  }

  if (!isInLiff) {
    // 在桌機瀏覽器中，顯示簡單登入提示
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-green-700 mb-4">匹克天堂</h1>
          <p className="text-gray-600 mb-6">請用 LINE 開啟此連結以預約場地</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">🔗 LINE MINI App</p>
            <code className="text-xs text-gray-500 break-all">
              {typeof window !== 'undefined' ? window.location.href : ''}
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-600">登入中...</p>
    </div>
  )
}
```

#### 步驟 5：建立應用入口（`src/app/page.tsx`）

替換現有的 `src/app/page.tsx`：

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/hooks/useLiff'

export default function Home() {
  const router = useRouter()
  const { initialized, user } = useLiff()

  useEffect(() => {
    if (initialized) {
      if (user) {
        // 已登入，導向預約流程
        router.replace('/booking')
      } else {
        // 未登入，導向登入頁
        router.replace('/login')
      }
    }
  }, [initialized, user, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-600">載入中...</p>
    </div>
  )
}
```

#### 步驟 6：建立登出流程

在 `src/app/account/page.tsx` 或 account 相關頁面中加入登出按鈕：

```typescript
'use client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/line/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      登出
    </button>
  )
}
```

建立登出端點（`src/app/api/auth/line/logout/route.ts`）：

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const store = await cookies()
  store.delete('ph_session')
  return NextResponse.json({ ok: true })
}
```

### 1.3 訊息流程

當用戶完成預約後，現有的 `src/lib/line.ts` 中的 `notifyBookingConfirmed` 函式已經處理了訊息推播。確保在以下位置調用：

- `src/app/checkout` — 付款成功後
- 後端結帳 action — 確認訂單時

範例：
```typescript
await notifyBookingConfirmed(user.lineUserId, bookingPayload, notificationToken)
```

---

## 任務 2️⃣ 測試 LINE 連結、身分與訊息流程

### 2.1 單元測試

建立 `src/lib/__tests__/line.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyLineIdToken, canPush, pushMessages } from '../line'

describe('LINE 驗證與推播', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('應驗證有效的 ID Token', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'U1234567890abcdef1234567890abcdef',
            name: '李明',
            picture: 'https://example.com/avatar.jpg',
            email: 'user@example.com',
          }),
      } as Response)
    )

    const profile = await verifyLineIdToken('valid-id-token')
    expect(profile.lineUserId).toBe('U1234567890abcdef1234567890abcdef')
    expect(profile.displayName).toBe('李明')
  })

  it('應在無效 Token 時拋出錯誤', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid token'),
      } as Response)
    )

    await expect(verifyLineIdToken('invalid-token')).rejects.toThrow()
  })

  it('canPush 應檢查 ACCESS_TOKEN 是否設定', () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = 'test-token'
    expect(canPush()).toBe(true)

    delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
    expect(canPush()).toBe(false)
  })
})
```

### 2.2 集成測試

建立測試腳本 `scripts/test-line-flow.mts`：

```typescript
import { db } from '../src/lib/db'
import { verifyLineIdToken, pushMessages, notifyBookingConfirmed } from '../src/lib/line'

async function testLineFlow() {
  console.log('🧪 開始 LINE 流程測試\n')

  try {
    // 1. 測試用戶建立
    console.log('1️⃣  建立測試用戶...')
    const user = await db.user.create({
      data: {
        lineUserId: 'U_TEST_' + Date.now(),
        displayName: '測試用戶',
      },
    })
    console.log(`   ✅ 用戶建立: ${user.id}\n`)

    // 2. 測試推播訊息
    console.log('2️⃣  測試推播訊息...')
    const pushResult = await pushMessages(user.lineUserId, [
      {
        type: 'text',
        text: '【測試】此為 LINE 推播測試訊息，若收到表示連線正常。',
      },
    ])
    console.log(`   ${pushResult ? '✅' : '⚠️'} 推播${pushResult ? '成功' : '失敗（請確認已設定 ACCESS_TOKEN）'}\n`)

    // 3. 測試預約通知
    console.log('3️⃣  測試預約完成通知...')
    await notifyBookingConfirmed(user.lineUserId, {
      code: 'TEST-001',
      venueName: '匹克天堂台北館',
      venueAddress: '台北市信義區',
      playDate: new Date().toISOString().split('T')[0],
      items: [
        {
          courtName: '1 號球場',
          startMinute: 540, // 09:00
          endMinute: 600, // 10:00
        },
      ],
      total: 300,
      bookingId: user.id,
    })
    console.log('   ✅ 通知已發送\n')

    console.log('✨ 所有測試完成！')
  } catch (err) {
    console.error('❌ 測試失敗:', err)
    process.exit(1)
  }
}

testLineFlow()
```

執行：
```bash
npm run verify:session  # 驗證現有會話邏輯
tsx -r ./scripts/stub-server-only.cjs scripts/test-line-flow.mts
```

### 2.3 手動測試清單

- [ ] 用 LINE 開啟 LIFF 應用，確認能成功登入
- [ ] 檢查用戶是否正確建立在 DB 中
- [ ] 完成一筆預約，檢查是否收到 LINE 推播通知
- [ ] 驗證 JWT Session 在登出後失效
- [ ] 測試用桌機瀏覽器開啟應用，確認顯示正確的提示訊息

---

## 任務 3️⃣ 更新服務條款與用戶同意機制

### 3.1 建立服務條款模型

編輯 `prisma/schema.prisma`，在 `User` model 下方加入：

```prisma
enum TermsVersion {
  V1 // 初版
  V2 // 若需更新時增加
}

model TermsAcceptance {
  id            String        @id @default(cuid())
  userId        String
  version       TermsVersion  @default(V1)
  acceptedAt    DateTime      @default(now())
  ipAddress     String?
  userAgent     String?

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, version])
  @@index([userId, acceptedAt])
}

// 在 User model 加入關聯
model User {
  // ... 現有欄位 ...
  termsAcceptances TermsAcceptance[]
}
```

執行遷移：
```bash
npm run db:turso:init
npm run db:seed
```

### 3.2 建立條款內容存儲

建立 `src/lib/terms.ts`：

```typescript
import 'server-only'

export enum TermsVersion {
  V1 = 'V1',
}

export const TERMS_CONTENT: Record<TermsVersion, { title: string; html: string }> = {
  [TermsVersion.V1]: {
    title: '使用條款與隱私政策 v1.0',
    html: `
      <div class="prose prose-sm max-w-none">
        <h2>匹克天堂 使用條款</h2>
        
        <h3>1. 服務範圍</h3>
        <p>匹克天堂提供線上場地預約服務，用戶透過 LINE MINI App 進行預約、付款與取消。</p>
        
        <h3>2. 用戶責任</h3>
        <ul>
          <li>用戶應確保提供的資訊真實、準確</li>
          <li>用戶應遵守場館規則與禮儀</li>
          <li>禁止轉讓、倒賣場地時段</li>
        </ul>
        
        <h3>3. 取消政策</h3>
        <ul>
          <li>開打前 48 小時：全額退款</li>
          <li>開打前 24 小時：收取 50% 費用</li>
          <li>開打前 2 小時：無法取消</li>
        </ul>
        
        <h3>4. 隱私保護</h3>
        <p>我們遵守個資法，用戶 LINE ID 與個人資訊僅用於預約服務與通知，不會轉售或分享。</p>
        
        <h3>5. 免責聲明</h3>
        <p>如因不可抗力（天災、場館維護）導致無法使用，我們將全額退款。</p>
        
        <h3>6. 聯絡方式</h3>
        <p>如有疑問，請洽服務專線：<strong>(02) XXXX-XXXX</strong></p>
        
        <hr />
        <p style="text-align: center; font-size: 0.875rem; color: #666;">
          最後更新：${new Date().toLocaleDateString('zh-TW')}
        </p>
      </div>
    `,
  },
}

export const CURRENT_TERMS_VERSION = TermsVersion.V1
```

### 3.3 建立條款同意 UI

建立 `src/components/terms-modal.tsx`：

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TERMS_CONTENT, TermsVersion } from '@/lib/terms'

export interface TermsModalProps {
  version: TermsVersion
  onAccept: (version: TermsVersion) => Promise<void>
  onReject?: () => void
  isRequired?: boolean
}

export function TermsModal({
  version,
  onAccept,
  onReject,
  isRequired = true,
}: TermsModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const terms = TERMS_CONTENT[version]

  const handleAccept = async () => {
    if (!agreed) return
    setLoading(true)
    try {
      await onAccept(version)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-green-50 border-b px-6 py-4">
          <h2 className="text-lg font-bold text-green-900">{terms.title}</h2>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: terms.html }}
          />
        </div>

        {/* Checkbox & Buttons */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              disabled={loading}
            />
            <span className="text-sm text-gray-700">
              我已閱讀並同意上述使用條款與隱私政策
            </span>
          </label>

          <div className="flex gap-3">
            {!isRequired && (
              <Button
                variant="outline"
                onClick={onReject}
                disabled={loading}
                className="flex-1"
              >
                稍後再看
              </Button>
            )}
            <Button
              onClick={handleAccept}
              disabled={!agreed || loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? '處理中...' : '我同意'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 3.4 建立條款同意 API

建立 `src/app/api/terms/accept/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { TERMS_CONTENT } from '@/lib/terms'

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('缺少 SESSION_SECRET')
  return new TextEncoder().encode(s)
}

export async function POST(req: NextRequest) {
  try {
    // 驗證 Session
    const store = await cookies()
    const token = store.get('ph_session')?.value
    if (!token) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, secret())
    const userId = payload.sub as string

    const { version } = await req.json()
    if (!version || !(version in TERMS_CONTENT)) {
      return NextResponse.json({ error: '版本無效' }, { status: 400 })
    }

    // 記錄同意
    const acceptance = await db.termsAcceptance.upsert({
      where: { userId_version: { userId, version } },
      update: { acceptedAt: new Date() },
      create: {
        userId,
        version,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
    })

    return NextResponse.json(acceptance)
  } catch (err) {
    console.error('[terms/accept]', err)
    return NextResponse.json({ error: '處理失敗' }, { status: 500 })
  }
}
```

### 3.5 整合至登入流程

編輯 `src/app/login/page.tsx`，在登入後顯示條款：

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/hooks/useLiff'
import { TermsModal } from '@/components/terms-modal'
import { CURRENT_TERMS_VERSION } from '@/lib/terms'

export default function LoginPage() {
  const router = useRouter()
  const { initialized, isInLiff, user, error } = useLiff()
  const [showTerms, setShowTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    if (initialized && user && !acceptedTerms) {
      // 檢查用戶是否已同意當前版本的條款
      fetch('/api/terms/check')
        .then((res) => res.json())
        .then((data) => {
          if (!data.accepted) {
            setShowTerms(true)
          } else {
            setAcceptedTerms(true)
            router.replace('/booking')
          }
        })
        .catch(() => setShowTerms(true))
    }
  }, [initialized, user, acceptedTerms, router])

  const handleTermsAccept = async (version: string) => {
    await fetch('/api/terms/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    })
    setAcceptedTerms(true)
    router.replace('/booking')
  }

  if (!initialized) {
    return <div className="flex items-center justify-center min-h-screen">初始化中...</div>
  }

  if (showTerms && user) {
    return (
      <TermsModal
        version={CURRENT_TERMS_VERSION}
        onAccept={handleTermsAccept}
        onReject={() => router.back()}
        isRequired={true}
      />
    )
  }

  // ... 其他登入 UI 邏輯 ...
  return null
}
```

建立條款檢查 API (`src/app/api/terms/check/route.ts`）：

```typescript
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { CURRENT_TERMS_VERSION } from '@/lib/terms'

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('缺少 SESSION_SECRET')
  return new TextEncoder().encode(s)
}

export async function GET() {
  try {
    const store = await cookies()
    const token = store.get('ph_session')?.value
    if (!token) {
      return NextResponse.json({ accepted: false })
    }

    const { payload } = await jwtVerify(token, secret())
    const userId = payload.sub as string

    const acceptance = await db.termsAcceptance.findUnique({
      where: { userId_version: { userId, version: CURRENT_TERMS_VERSION } },
    })

    return NextResponse.json({ accepted: !!acceptance })
  } catch {
    return NextResponse.json({ accepted: false })
  }
}
```

### 3.6 管理後台查詢

在 `src/app/admin/page.tsx` 或新建統計頁面中加入條款同意統計：

```typescript
// src/app/admin/terms-analytics/page.tsx
import { db } from '@/lib/db'
import { TERMS_CONTENT, TermsVersion } from '@/lib/terms'

export default async function TermsAnalyticsPage() {
  const stats = await Promise.all(
    Object.values(TermsVersion).map(async (version) => ({
      version,
      title: TERMS_CONTENT[version].title,
      count: await db.termsAcceptance.count({ where: { version } }),
    }))
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">服務條款同意統計</h1>
      <div className="grid grid-cols-1 gap-4">
        {stats.map((stat) => (
          <div key={stat.version} className="border rounded-lg p-4">
            <h2 className="font-bold text-lg">{stat.title}</h2>
            <p className="text-gray-600 text-2xl mt-2">{stat.count} 人同意</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 實施時間表

| 任務 | 估計時間 | 優先級 |
|------|---------|--------|
| 1. LIFF 初始化與登入流程 | 4-6 小時 | 🔴 高 |
| 2. 端對端測試 | 2-3 小時 | 🟠 中 |
| 3. 服務條款與同意機制 | 3-4 小時 | 🟠 中 |

**總計：9-13 小時**

---

## 檢查清單

### 環境設定
- [ ] `.env.local` 已設定所有必要的 LINE 環境變數
- [ ] `SESSION_SECRET` 已設定（32+ 字元隨機字串）

### 登入流程
- [ ] `src/hooks/useLiff.ts` 已建立並測試
- [ ] `src/app/api/auth/line/verify/route.ts` 已建立
- [ ] `src/app/login/page.tsx` 已建立
- [ ] `src/app/api/auth/line/logout/route.ts` 已建立
- [ ] 用戶能成功透過 LINE 登入

### 訊息推播
- [ ] 既有的 `notifyBookingConfirmed` 已整合至結帳流程
- [ ] 測試訊息能成功推送至已登入的用戶

### 服務條款
- [ ] Prisma schema 已更新（TermsAcceptance model）
- [ ] `src/lib/terms.ts` 已建立，含條款內容
- [ ] `src/components/terms-modal.tsx` UI 已完成
- [ ] `/api/terms/accept` 和 `/api/terms/check` 端點已建立
- [ ] 登入流程已整合條款同意模態框

### 測試
- [ ] 單元測試已撰寫並通過
- [ ] 集成測試已執行
- [ ] 手動測試清單已全部完成

---

## 故障排解

**Q: 登入後頁面持續轉圈？**
A: 檢查 `SESSION_SECRET` 是否正確設定，且長度 ≥ 16 字元。

**Q: LINE 推播訊息未送達？**
A: 確認 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 已設定，且用戶已加入官方帳號好友。

**Q: 條款同意在重新整理後消失？**
A: 檢查 `ph_session` Cookie 是否正確設定為 HttpOnly，且 Session Token 未過期。

---

## 下一步

實施完畢後，考慮：
1. **推送服務訊息範本審核** — 向 LINE 申請自訂服務訊息範本（加速通知）
2. **金流整合驗證** — 確保訂單完成後的推播與退款流程
3. **分析與監控** — 追蹤用戶留存率、取消率、推播成功率
