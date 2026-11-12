# 顧好預約平台 — 預約條款系統實現計劃

## 一、條款內容總結與系統映射

### 1.1 條款核心規則

| 條款 | 系統實現位置 | 優先級 |
|------|------------|------|
| **場地規範** | 預約前提示 / 簽署條款 | P3（資訊性） |
| **自助取消規則** | 訂單詳情頁 / 取消邏輯 | P1（關鍵業務） |
| **退款方式** | 退款引擎 / 金流整合 | P1（涉及資金） |

```
開打時間
  ↓ 24 小時線
  ├─ ≥ 24 小時前：可自助取消 → 全額退款
  ├─ < 24 小時：禁止自助取消 → 系統鎖定
  └─ 已報到（Check-in）：禁止取消 → No-Show 無退款
```

---

## 二、資料模型設計

### 2.1 新增 / 擴展 Prisma 欄位

**已有基礎模型**
- `Booking`: 訂單主記錄
- `Refund`: 退款記錄
- `Reservation`: 場地佔用時段

**新增欄位**

```prisma
model Booking {
  // 現有欄位
  id        String
  code      String  @unique
  userId    String
  venueId   String
  playDate  String
  status    BookingStatus
  
  // 新增欄位
  
  /// 訂單簽署狀態
  termsAckedAt      DateTime?
  termsVersion      String?          // 簽署時的條款版本
  
  /// 最近一次自助取消嘗試時間及結果
  lastCancelAttempt DateTime?
  cancelAttemptReason String?        // 拒絕原因（如「已報到」）
  
  /// Check-in 狀態
  checkedInAt       DateTime?         // null 表示未報到
  noShowReason      String?
  
  /// 退款期限信息
  cancelDeadlineAt  DateTime?         // 24 小時截止點
  refundEligible    Boolean           // 是否符合退款資格
  
  // 關聯
  refunds           Refund[]
  cancellationLog   CancellationLog[]
}

model CancellationLog {
  id                String    @id @default(cuid())
  bookingId         String
  
  /// 嘗試時間
  attemptAt         DateTime  @default(now())
  
  /// 狀態：SUCCESS / REJECTED_TOO_LATE / REJECTED_CHECKED_IN / REJECTED_OTHER
  status            String
  
  /// 拒絕原因說明
  rejectionReason   String?
  
  /// 距開打時間（分鐘）— 用於稽核
  minutesBeforeStart Int?
  
  /// 操作人（自助或人工）
  operatedBy        String    @default("USER") // USER / ADMIN
  
  createdAt         DateTime  @default(now())
  
  booking           Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  
  @@index([bookingId, attemptAt])
  @@index([status])
}

model Refund {
  // 現有欄位
  id              String
  bookingId       String
  idempotencyKey  String  @unique
  status          String  // PROCESSING / SUCCEEDED / FAILED / MANUAL_PENDING
  
  // 新增欄位
  
  /// 退款是否符合「全額退款」條件
  fullRefundEligible  Boolean
  
  /// 取消截止點時間
  cancelDeadlineAt DateTime?
  
  /// 實際取消時間
  actualCancelledAt DateTime?
  
  /// 是否為超期退款（可能需人工審核）
  isLateRefund    Boolean @default(false)
  
  /// 退款流程狀態細節
  refundBreakdown Json?   // 詳見下表
}
```

**Refund Breakdown JSON 結構**

```json
{
  "scenarioType": "FULL_REFUND | PARTIAL_REFUND | NO_REFUND | NO_SHOW",
  "reason": "取消於截止前 24 小時 | ...",
  "originalAmount": 1000,
  "refundAmount": 1000,
  "refundMethod": "ORIGINAL_CARD | POINTS | VOUCHER | MANUAL",
  "details": {
    "refundItems": [
      {
        "itemType": "COURT",
        "itemId": "...",
        "originalPrice": 1000,
        "refundAmount": 1000
      }
    ],
    "deductedPoints": 0,
    "refundedPoints": 200
  },
  "timeline": {
    "bookingCreatedAt": "2026-11-15T10:00:00Z",
    "playDate": "2026-11-20",
    "playStartTime": "2026-11-20T10:00:00Z",
    "cancelDeadlineAt": "2026-11-19T10:00:00Z",  // 24小時前
    "cancelledAt": "2026-11-19T09:30:00Z",
    "minutesBeforeCancelDeadline": 30
  }
}
```

---

## 三、取消與退款業務規則

### 3.1 決策樹

```
訂單狀態？
├─ PENDING（待付款）
│   └─ 直接釋放時段（無退款涉及）
│
├─ PAID（已付款）
│   └─ 已報到？
│       ├─ YES（已報到）
│       │   └─ ✗ 禁止取消
│       │       └─ 標記 NO_SHOW（無退款）
│       │
│       └─ NO（未報到）
│           └─ 開打時間 ≥ 24 小時？
│               ├─ YES（滿足退款條件）
│               │   └─ ✓ 允許自助取消
│               │       └─ 全額退款至原付款方式 / 點數
│               │
│               └─ NO（< 24 小時）
│                   └─ ✗ 禁止自助取消
│                       └─ 可由管理員人工審核
│                           └─ 可能降級為無退款或部分退款
│
└─ CANCELLED（已取消）
    └─ 狀態無變化
```

### 3.2 規則引擎實現

**檔案：`src/lib/refund-rules.ts`**

```typescript
/**
 * 退款資格判斷引擎
 */

export interface RefundEligibilityInput {
  booking: Booking
  playDateTime: DateTime
  currentDateTime: DateTime
  isCheckedIn: boolean
  venue: Venue
}

export interface RefundEligibilityResult {
  eligible: boolean
  reason: 'FULL_REFUND' | 'NO_REFUND' | 'LATE_CANCEL' | 'CHECKED_IN' | 'OTHER'
  minutesBeforeCancelDeadline: number
  fullRefundAmount: number
  actualRefundAmount: number
  refundMethod: 'ORIGINAL_CARD' | 'POINTS' | 'VOUCHER' | 'MANUAL'
  requiresManualReview: boolean
  message: string
}

export class RefundRuleEngine {
  /**
   * 判斷訂單是否符合退款資格
   */
  static evaluateEligibility(
    input: RefundEligibilityInput
  ): RefundEligibilityResult {
    const {
      booking,
      playDateTime,
      currentDateTime,
      isCheckedIn,
      venue,
    } = input

    // 規則 1: 已報到 → 無退款
    if (isCheckedIn) {
      return {
        eligible: false,
        reason: 'CHECKED_IN',
        minutesBeforeCancelDeadline: -999,
        fullRefundAmount: 0,
        actualRefundAmount: 0,
        refundMethod: 'MANUAL',
        requiresManualReview: false,
        message: '訂單已報到，無法取消退款',
      }
    }

    // 計算距開打時間
    const minutesUntilStart = differenceInMinutes(
      playDateTime,
      currentDateTime
    )

    const cancelDeadlineAt = subHours(playDateTime, 24)
    const minutesBeforeCancelDeadline = differenceInMinutes(
      cancelDeadlineAt,
      currentDateTime
    )

    // 規則 2: 開打前 ≥ 24 小時 → 全額退款
    if (minutesBeforeCancelDeadline >= 0) {
      return {
        eligible: true,
        reason: 'FULL_REFUND',
        minutesBeforeCancelDeadline,
        fullRefundAmount: booking.total,
        actualRefundAmount: booking.total,
        refundMethod: this.determineRefundMethod(booking),
        requiresManualReview: false,
        message: `符合全額退款條件（開打前 ${minutesUntilStart} 分鐘）`,
      }
    }

    // 規則 3: < 24 小時 → 拒絕自助，但可人工審核
    return {
      eligible: false,
      reason: 'LATE_CANCEL',
      minutesBeforeCancelDeadline,
      fullRefundAmount: booking.total,
      actualRefundAmount: 0,
      refundMethod: 'MANUAL',
      requiresManualReview: true,
      message: `取消時間已超過截止點（${
        Math.abs(minutesBeforeCancelDeadline)
      } 分鐘後）。如需取消，請聯繫管理員。`,
    }
  }

  /**
   * 判斷退款方式（按優先順序）
   */
  private static determineRefundMethod(
    booking: Booking
  ): 'ORIGINAL_CARD' | 'POINTS' | 'VOUCHER' | 'MANUAL' {
    // 優先順序：
    // 1. 原付款方式（信用卡、LINE Pay）
    // 2. 使用券 → 退券
    // 3. 點數 → 退點數
    // 4. 混合 → 按比例分別退款

    if (booking.pointsUsed > 0) {
      return 'POINTS'
    }
    if (booking.voucherCode) {
      return 'VOUCHER'
    }
    return 'ORIGINAL_CARD'
  }
}
```

---

## 四、前端取消流程

### 4.1 訂單詳情頁面

**檔案：`src/app/booking/[code]/page.tsx`**

```typescript
export default async function BookingDetailPage({
  params,
}: {
  params: { code: string }
}) {
  const booking = await getBooking(params.code)
  const playDateTime = getPlayDateTime(booking)
  const currentDateTime = new Date()

  // 評估退款資格
  const eligibility = RefundRuleEngine.evaluateEligibility({
    booking,
    playDateTime,
    currentDateTime,
    isCheckedIn: !!booking.checkedInAt,
    venue: booking.venue,
  })

  return (
    <div>
      {/* 訂單摘要 */}
      <BookingSummary booking={booking} />

      {/* 取消區塊 */}
      {booking.status === 'PAID' && !booking.checkedInAt && (
        <CancellationPanel
          booking={booking}
          eligibility={eligibility}
          onCancel={handleCancelBooking}
        />
      )}

      {/* 已報到 → 提示 No-Show 政策 */}
      {booking.checkedInAt && (
        <Alert variant="info">
          <AlertTitle>已報到</AlertTitle>
          <AlertDescription>
            訂單已報到，無法自助取消。如有特殊情況，請聯繫客服。
          </AlertDescription>
        </Alert>
      )}

      {/* 退款詳情 */}
      {booking.refunds.length > 0 && (
        <RefundHistory refunds={booking.refunds} />
      )}
    </div>
  )
}
```

**`components/CancellationPanel.tsx`**

```typescript
export function CancellationPanel({
  booking,
  eligibility,
  onCancel,
}: CancellationPanelProps) {
  const [isPending, setIsPending] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>取消訂單</CardTitle>
        <CardDescription>
          {eligibility.minutesBeforeCancelDeadline >= 0
            ? `✓ 符合全額退款條件（${eligibility.minutesBeforeCancelDeadline} 分鐘內）`
            : `✗ 已超過取消期限（超時 ${Math.abs(
                eligibility.minutesBeforeCancelDeadline
              )} 分鐘）`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {eligibility.eligible ? (
          <>
            <p className="text-sm mb-4">
              <strong>退款金額：</strong>NT${eligibility.actualRefundAmount}
            </p>
            <p className="text-sm mb-4">
              <strong>退款方式：</strong>
              {eligibility.refundMethod === 'ORIGINAL_CARD' && '退回原付款信用卡'}
              {eligibility.refundMethod === 'POINTS' && '退回至點數帳戶'}
              {eligibility.refundMethod === 'VOUCHER' && '退回使用券'}
            </p>
            <p className="text-xs text-gray-500 mb-6">
              刷退通常需要 3-5 個工作日，視發卡銀行作業而定。
            </p>
            <Button
              onClick={() => onCancel(booking.id)}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? '取消中...' : '確認取消並申請退款'}
            </Button>
          </>
        ) : eligibility.requiresManualReview ? (
          <>
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>已超過自助取消時限</AlertTitle>
              <AlertDescription>
                {eligibility.message}
                <br />
                <Link href="/help" className="text-blue-600 underline">
                  聯繫客服 →
                </Link>
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>無法取消</AlertTitle>
            <AlertDescription>{eligibility.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 五、後端取消與退款 API

### 5.1 取消訂單 API

**檔案：`src/app/api/booking/[id]/cancel/route.ts`**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await verifyAuth() // 驗證使用者
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        venue: true,
        reservations: true,
      },
    })

    if (!booking) return new Response('訂單不存在', { status: 404 })
    if (booking.userId !== userId) return new Response('無權限', { status: 403 })

    // 1. 評估退款資格
    const playDateTime = getPlayDateTime(booking)
    const eligibility = RefundRuleEngine.evaluateEligibility({
      booking,
      playDateTime,
      currentDateTime: new Date(),
      isCheckedIn: !!booking.checkedInAt,
      venue: booking.venue,
    })

    // 2. 檢查是否允許自助取消
    if (!eligibility.eligible && !eligibility.requiresManualReview) {
      return new Response(
        JSON.stringify({
          error: eligibility.message,
          canRequestManualReview: false,
        }),
        { status: 400 }
      )
    }

    // 3. 建立退款記錄
    const refund = await prisma.refund.create({
      data: {
        bookingId: booking.id,
        idempotencyKey: `cancel-${booking.id}-${Date.now()}`,
        status: 'PROCESSING',
        method: eligibility.refundMethod,
        cashAmount: eligibility.actualRefundAmount,
        pointsAmount: eligibility.refundMethod === 'POINTS'
          ? eligibility.actualRefundAmount
          : 0,
        reason: '使用者自助取消',
        cancelItems: true,
        fullRefundEligible: eligibility.eligible,
        isLateRefund: eligibility.reason === 'LATE_CANCEL',
        refundBreakdown: {
          scenarioType: eligibility.reason,
          reason: eligibility.message,
          originalAmount: booking.total,
          refundAmount: eligibility.actualRefundAmount,
          refundMethod: eligibility.refundMethod,
          timeline: {
            bookingCreatedAt: booking.createdAt,
            cancelledAt: new Date(),
            minutesBeforeCancelDeadline: eligibility.minutesBeforeCancelDeadline,
          },
        } as any,
        createdBy: userId,
      },
    })

    // 4. 記錄取消日誌
    await prisma.cancellationLog.create({
      data: {
        bookingId: booking.id,
        status: eligibility.eligible ? 'SUCCESS' : 'MANUAL_REVIEW_REQUIRED',
        rejectionReason: eligibility.eligible ? null : eligibility.reason,
        minutesBeforeStart: differenceInMinutes(
          playDateTime,
          new Date()
        ),
        operatedBy: 'USER',
      },
    })

    // 5. 更新訂單狀態
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        lastCancelAttempt: new Date(),
      },
    })

    // 6. 釋放時段（Reservation）
    await prisma.reservation.deleteMany({
      where: { bookingId: booking.id },
    })

    // 7. 發起退款流程（非同步）
    await processRefund(refund.id, eligibility)

    // 8. 發送通知（LINE / Email）
    await sendCancellationNotification(booking, refund, eligibility)

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.cashAmount,
        estimatedProcessingTime: '3-5 個工作日',
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('取消訂單失敗', error)
    return new Response('取消訂單失敗', { status: 500 })
  }
}
```

### 5.2 退款處理

**檔案：`src/server/refund-processor.ts`**

```typescript
/**
 * 退款處理引擎
 * 負責向金流商發起退款請求
 */

export async function processRefund(
  refundId: string,
  eligibility: RefundEligibilityResult
) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { booking: { include: { payments: true } } },
  })

  if (!refund) throw new Error('退款記錄不存在')

  const booking = refund.booking
  const originalPayment = booking.payments[0]

  try {
    // 1. 根據原付款方式決定退款管道
    let result

    if (eligibility.refundMethod === 'POINTS') {
      // 退點數
      result = await processPointsRefund(booking, eligibility.actualRefundAmount)
    } else if (eligibility.refundMethod === 'ORIGINAL_CARD') {
      // 向金流商申請刷退
      result = await processCardRefund(originalPayment, eligibility.actualRefundAmount)
    } else if (eligibility.refundMethod === 'VOUCHER') {
      // 恢復使用券
      result = await restoreVoucher(booking)
    }

    // 2. 更新退款狀態
    await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: result.status,
        providerRef: result.providerRef,
        completedAt: new Date(),
      },
    })

    // 3. 記錄事件
    await createControlEvent({
      eventType: 'REFUND_PROCESSED',
      title: `退款已${result.status === 'SUCCEEDED' ? '完成' : '處理'}`,
      description: `訂單 ${booking.code} 退款 NT$${eligibility.actualRefundAmount}`,
      data: { refundId, result },
    })
  } catch (error) {
    console.error(`退款處理失敗 [${refundId}]`, error)
    
    // 標記為失敗或待人工處理
    await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'MANUAL_PENDING',
        failReason: error instanceof Error ? error.message : '未知錯誤',
      },
    })

    // 發送告警給管理員
    await alertAdmins({
      type: 'REFUND_FAILED',
      bookingCode: booking.code,
      amount: eligibility.actualRefundAmount,
    })
  }
}

/**
 * 點數退款
 */
async function processPointsRefund(
  booking: Booking,
  amount: number
): Promise<{ status: string; providerRef?: string }> {
  // 入帳至 PointsLedger
  await prisma.pointsLedger.create({
    data: {
      userId: booking.userId,
      delta: amount,
      balanceAfter: (await getUserPoints(booking.userId)) + amount,
      kind: 'REFUND',
      reason: `訂單 ${booking.code} 取消退款`,
      actor: 'SYSTEM',
      bookingId: booking.id,
    },
  })

  return { status: 'SUCCEEDED' }
}

/**
 * 信用卡刷退
 */
async function processCardRefund(
  payment: Payment,
  amount: number
): Promise<{ status: string; providerRef?: string }> {
  const provider = payment.provider // 'tappay' / 'newebpay' / 'linepay'

  // 調用金流 SDK 發起刷退
  const result = await PaymentGateway.refund(provider, {
    transactionId: payment.providerRef,
    amount,
  })

  return {
    status: result.success ? 'SUCCEEDED' : 'FAILED',
    providerRef: result.refundId,
  }
}

/**
 * 恢復使用券
 */
async function restoreVoucher(booking: Booking) {
  if (!booking.voucherCode) {
    return { status: 'SKIPPED' }
  }

  await prisma.voucher.update({
    where: { code: booking.voucherCode },
    data: {
      usedAt: null,
      bookingId: null,
    },
  })

  return { status: 'SUCCEEDED' }
}
```

---

## 六、場地規範与簽署條款

### 6.1 條款簽署流程

首次登入或條款更新時，使用者須簽署最新版本。

**模型擴展**

```prisma
model TermsVersion {
  id          String    @id @default(cuid())
  version     String    @unique  // "v1.0", "v1.1"
  
  /// 條款內容（Markdown）
  content     String
  
  /// 生效日期
  effectiveAt DateTime
  
  /// 條款更新摘要
  summary     String?
  
  createdAt   DateTime  @default(now())
}

model UserTermsSignature {
  id          String    @id @default(cuid())
  userId      String
  termsVersion String
  
  /// 簽署時間
  signedAt    DateTime  @default(now())
  
  /// IP 和 User-Agent（稽核用）
  ipAddress   String?
  userAgent   String?
  
  user        User      @relation(fields: [userId], references: [id])
  
  @@unique([userId, termsVersion])
  @@index([userId, signedAt])
}
```

### 6.2 條款檢查中間件

**檔案：`src/middleware/check-terms.ts`**

```typescript
export async function checkTermsAcknowledgment(
  req: NextRequest,
  userId: string
): Promise<Response | null> {
  // 1. 獲取最新條款版本
  const latestTerms = await getLatestTermsVersion()
  if (!latestTerms) return null // 無條款要求

  // 2. 檢查使用者是否簽署過
  const signature = await prisma.userTermsSignature.findUnique({
    where: {
      userId_termsVersion: {
        userId,
        termsVersion: latestTerms.version,
      },
    },
  })

  if (!signature) {
    // 使用者未簽署最新版本
    return new Response(
      JSON.stringify({
        error: 'TERMS_NOT_ACKNOWLEDGED',
        message: '您需要簽署最新的條款才能繼續',
        latestVersion: latestTerms.version,
        termsContent: latestTerms.content,
      }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    )
  }

  return null // 允許繼續
}
```

### 6.3 條款內容管理頁面

**檔案：`src/app/admin/settings/terms/page.tsx`**

```typescript
export default async function TermsManagementPage() {
  const currentVersion = await getLatestTermsVersion()
  const allVersions = await getAllTermsVersions()

  return (
    <div>
      <h1>預約條款管理</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>當前版本：{currentVersion.version}</CardTitle>
          <CardDescription>
            生效於 {formatDateTime(currentVersion.effectiveAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReactMarkdown>{currentVersion.content}</ReactMarkdown>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>發佈新版本</CardTitle>
        </CardHeader>
        <CardContent>
          <TermsEditor onPublish={handlePublishNewVersion} />
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-4">版本歷史</h2>
      <TermsVersionHistory versions={allVersions} />
    </div>
  )
}
```

---

## 七、後台管理 — 取消與退款審核

### 7.1 後台退款清單

**檔案：`src/app/admin/refunds/page.tsx`**

```typescript
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const status = searchParams.status || 'PROCESSING'
  const page = parseInt(searchParams.page || '1')

  const refunds = await prisma.refund.findMany({
    where: { status },
    include: {
      booking: {
        include: { user: true, venue: true },
      },
    },
    skip: (page - 1) * 20,
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <h1>退款管理</h1>

      <Tabs defaultValue="PROCESSING" onValueChange={(v) => {
        // 導向不同狀態的篩選
      }}>
        <TabsList>
          <TabsTrigger value="PROCESSING">處理中 ({counts.processing})</TabsTrigger>
          <TabsTrigger value="SUCCEEDED">已完成 ({counts.succeeded})</TabsTrigger>
          <TabsTrigger value="FAILED">失敗 ({counts.failed})</TabsTrigger>
          <TabsTrigger value="MANUAL_PENDING">待人工 ({counts.manual})</TabsTrigger>
        </TabsList>

        <TabsContent value={status}>
          <RefundTable
            refunds={refunds}
            onApprove={handleApproveRefund}
            onReject={handleRejectRefund}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 7.2 退款詳情與人工審核

**檔案：`src/app/admin/refunds/[id]/page.tsx`**

```typescript
export default async function RefundDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const refund = await prisma.refund.findUnique({
    where: { id: params.id },
    include: {
      booking: {
        include: {
          user: true,
          venue: true,
          items: true,
          cancellationLog: true,
        },
      },
      items: true,
    },
  })

  return (
    <div>
      <BookingSummary booking={refund.booking} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>退款詳情</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <dt>原始金額</dt>
            <dd>NT${refund.booking.total}</dd>

            <dt>退款金額</dt>
            <dd>NT${refund.cashAmount}</dd>

            <dt>退款方式</dt>
            <dd>{refund.method}</dd>

            <dt>符合全額退款</dt>
            <dd>{refund.fullRefundEligible ? '✓' : '✗'}</dd>

            <dt>是否超期</dt>
            <dd>{refund.isLateRefund ? '是（需人工審核）' : '否'}</dd>

            <dt>時間線</dt>
            <dd>
              <pre>{JSON.stringify(refund.refundBreakdown?.timeline, null, 2)}</pre>
            </dd>
          </dl>
        </CardContent>
      </Card>

      {refund.status === 'MANUAL_PENDING' && (
        <Card>
          <CardHeader>
            <CardTitle>人工審核</CardTitle>
            <CardDescription>此退款需要管理員審核與批准</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitReview}>
              <div>
                <label>審核結果</label>
                <RadioGroup>
                  <div>
                    <Radio value="APPROVE" />
                    <label>批准全額退款</label>
                  </div>
                  <div>
                    <Radio value="PARTIAL" />
                    <label>部分退款</label>
                    <Input type="number" placeholder="金額" />
                  </div>
                  <div>
                    <Radio value="REJECT" />
                    <label>拒絕（無退款）</label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <label>備註</label>
                <Textarea placeholder="人工審核備註（可見使用者）" />
              </div>

              <Button type="submit">提交審核</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <CancellationLog bookingId={refund.bookingId} />
    </div>
  )
}
```

---

## 八、通知系統整合

### 8.1 取消與退款通知

**檔案：`src/server/booking-notification.ts`**

```typescript
export async function sendCancellationNotification(
  booking: Booking,
  refund: Refund,
  eligibility: RefundEligibilityResult
) {
  const message = buildCancellationMessage(booking, eligibility)

  // LINE 通知
  await sendLineNotification({
    userId: booking.userId,
    type: 'BOOKING_CANCELLED',
    message,
    buttons: [
      {
        label: '查看退款進度',
        link: `/refund/${refund.id}`,
      },
      {
        label: '重新預約',
        link: '/booking',
      },
    ],
  })

  // Email 通知（含收據）
  await sendEmail({
    to: booking.user.email,
    subject: `取消確認 — 訂單 ${booking.code}`,
    template: 'cancellation-receipt',
    data: {
      booking,
      refund,
      eligibility,
    },
  })
}

function buildCancellationMessage(
  booking: Booking,
  eligibility: RefundEligibilityResult
): string {
  return `
✓ 取消成功

訂單代號：${booking.code}
原始金額：NT$${booking.total}
退款金額：NT$${eligibility.actualRefundAmount}
退款方式：${
    eligibility.refundMethod === 'ORIGINAL_CARD'
      ? '退回原信用卡（3-5 個工作日）'
      : eligibility.refundMethod === 'POINTS'
      ? '退回點數帳戶'
      : '恢復使用券'
  }

預計入帳時間：${
    eligibility.refundMethod === 'ORIGINAL_CARD'
      ? '3-5 個工作日（視銀行作業）'
      : '立即'
  }
  `.trim()
}
```

---

## 九、稽核與合規

### 9.1 取消日誌分析

```sql
-- 查詢特定時段取消統計
SELECT
  DATE(attemptAt) as date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'REJECTED_TOO_LATE' THEN 1 ELSE 0 END) as late_cancels,
  SUM(CASE WHEN status = 'REJECTED_CHECKED_IN' THEN 1 ELSE 0 END) as no_shows
FROM
  CancellationLog
WHERE
  attemptAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY
  DATE(attemptAt)
ORDER BY
  date DESC;
```

### 9.2 退款異常檢測

```typescript
// src/server/refund-audit.ts
export async function detectRefundAnomalies() {
  // 1. 查詢失敗或待人工審核的退款
  const anomalies = await prisma.refund.findMany({
    where: {
      status: { in: ['FAILED', 'MANUAL_PENDING'] },
      createdAt: { gte: subDays(new Date(), 1) },
    },
  })

  // 2. 按類型分類並產生告警
  for (const anomaly of anomalies) {
    await createIncident({
      type: 'REFUND_ANOMALY',
      severity: anomaly.status === 'FAILED' ? 'HIGH' : 'MEDIUM',
      title: `退款異常 [${anomaly.id}]`,
      detail: `訂單 ${anomaly.bookingId} 退款狀態 ${anomaly.status}`,
    })
  }
}
```

---

## 十、實現檢查清單

### 第 1 週：資料模型與規則引擎
- [ ] 擴展 Prisma schema（Booking、Refund、CancellationLog）
- [ ] 實現 RefundRuleEngine
- [ ] 單元測試（18+ 個場景）

### 第 2 週：前端取消流程
- [ ] 訂單詳情頁面取消區塊
- [ ] CancellationPanel 元件
- [ ] 實時退款資格評估前端顯示

### 第 3 週：後端 API 與金流整合
- [ ] `/api/booking/[id]/cancel` 路由
- [ ] RefundProcessor（金流、點數、券）
- [ ] 取消日誌與通知

### 第 4 週：後台管理與通知
- [ ] 後台退款清單與審核
- [ ] 退款詳情頁面
- [ ] LINE / Email 通知範本

### 第 5 週：測試與部署
- [ ] 端到端測試（取消 → 退款全流程）
- [ ] 金流測試（mock 和實機）
- [ ] 線上灰度發佈

---

## 十一、預約條款內容（Markdown）

**`prisma/terms/v1.0.md`**

```markdown
# 顧好預約平台 — 預約條款

## 場地規範

請著運動鞋進場（禁止高跟鞋、皮鞋等硬底鞋進入球場），請愛惜場地、注意安全。

## 取消規則

如需取消，請於開打前在「我的訂單」自助申請退款，退款比例依距開打時間計算（見下方「退款方式」）。

**已完成報到（check-in）後無法取消；未到場（No-Show）恕不退款。**

## 退款方式

- **開打前 24 小時（含）以上取消**：全額退款
- **未滿 24 小時**：恕不退款，系統亦不開放自助取消。如有特殊情況，請聯繫客服。
  
款項直接退回原付款方式（信用卡刷退回原卡），不需另外申請；刷退實際入帳時間依發卡銀行作業而定，通常需數個工作日。

以點數付款的訂單退回點數至會員帳戶。

以使用券折抵的預約，於可全額退款的時段內取消會回復該使用券，其餘時段恕不退券。
```

---

## 十二、風險與緩解

| 風險 | 緩解措施 |
|------|--------|
| 金流退款失敗 | 建立 MANUAL_PENDING 人工審核流程；定時檢測失敗並告警 |
| 使用者誤操作取消 | 取消前展示二次確認對話框；清晰說明退款方式與時間 |
| 時區邊界情況 | 使用場館 timezone（Venue.timezone），避免系統時區差異 |
| 超期退款爭議 | 明確記錄取消時間、截止時間、時差；所有決策可稽核追蹤 |

---

## 十三、成功標準

✓ 使用者可在開打前 24 小時內自助取消並申請全額退款
✓ 系統自動拒絕超期取消（< 24 小時）並引導至人工審核
✓ 已報到訂單禁止取消（No-Show 無退款）
✓ 退款金額準確、入帳方式正確
✓ 所有取消與退款流程可稽核追蹤
✓ 使用者獲得清晰的 LINE / Email 通知
