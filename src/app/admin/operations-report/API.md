# 營運狀況報表 API 文檔

## 概述

營運狀況報表 API 提供場館營運數據聚合和分析功能，支持多種時間範圍和導出格式。

**基礎 URL**: `/admin/operations-report`

**認證**: 需要 `finance` 權限

**版本**: v1.0.0

---

## 端點

### 1. 獲取操作指標

**請求**
```
GET /api/operations-metrics?from=2024-11-20&to=2024-11-30
```

**參數**
| 參數 | 類型 | 必須 | 說明 |
|------|------|------|------|
| from | string (YYYY-MM-DD) | ✓ | 開始日期 |
| to | string (YYYY-MM-DD) | ✓ | 結束日期 |

**響應**
```json
{
  "bookingCompletion": {
    "completionRate": 85,
    "totalBookings": 100,
    "completedBookings": 85,
    "cancelledBookings": 10,
    "expiredBookings": 5,
    "changePercent": 5
  },
  "courtUtilization": {
    "overallUtilization": 70,
    "peakUtilization": 90,
    "offPeakUtilization": 50,
    "totalSlots": 1000,
    "bookedSlots": 700,
    "changePercent": 3
  },
  "entries": {
    "totalEntries": 1500,
    "averagePerDay": 214,
    "changePercent": 8,
    "dailyBreakdown": []
  },
  "doorAccess": {
    "successRate": 98,
    "successCount": 980,
    "failureCount": 20,
    "totalAttempts": 1000,
    "changePercent": 2,
    "lastUpdated": "2024-11-30T15:30:00Z",
    "hasData": true
  },
  "timestamp": "2024-11-30T15:35:00Z"
}
```

**狀態碼**
| 代碼 | 說明 |
|------|------|
| 200 | 成功 |
| 400 | 無效的日期參數 |
| 403 | 無權限訪問 |
| 500 | 服務器錯誤 |

---

### 2. 獲取每日趨勢

**請求**
```
GET /api/operations-trends?from=2024-11-20&to=2024-11-30
```

**參數**
| 參數 | 類型 | 必須 | 說明 |
|------|------|------|------|
| from | string (YYYY-MM-DD) | ✓ | 開始日期 |
| to | string (YYYY-MM-DD) | ✓ | 結束日期 |

**響應**
```json
[
  {
    "date": "2024-11-24",
    "bookingCount": 10,
    "entryCount": 150,
    "completionRate": 85,
    "cancelationRate": 15,
    "utilizationRate": 70
  },
  ...
]
```

---

### 3. 獲取時段分布

**請求**
```
GET /api/operations-time-slots?from=2024-11-20&to=2024-11-30
```

**響應**
```json
[
  {
    "timeSlot": "18:00",
    "averageUtilization": 90,
    "bookingCount": 15,
    "entryCount": 120
  },
  ...
]
```

---

### 4. 獲取場地對比

**請求**
```
GET /api/operations-courts?from=2024-11-20&to=2024-11-30
```

**響應**
```json
[
  {
    "courtId": "c1",
    "courtName": "籃球場 1",
    "utilizationRate": 75,
    "peakUtilization": 95,
    "offPeakUtilization": 55,
    "bookingCount": 50,
    "cancelationCount": 5,
    "status": "good"
  },
  ...
]
```

**status 值**
- `good`: 利用率 > 75%
- `fair`: 利用率 50-75%
- `needs_attention`: 利用率 < 50%

---

### 5. 獲取平日/假日對比

**請求**
```
GET /api/operations-weekday?from=2024-11-20&to=2024-11-30
```

**響應**
```json
[
  {
    "weekday": "weekday",
    "avgUtilization": 54,
    "avgBookings": 45,
    "avgEntries": 380
  },
  {
    "weekday": "weekend",
    "avgUtilization": 88,
    "avgBookings": 78,
    "avgEntries": 650
  }
]
```

---

### 6. 獲取預約狀態分布

**請求**
```
GET /api/operations-booking-status?from=2024-11-20&to=2024-11-30
```

**響應**
```json
{
  "completed": 85,
  "pending": 10,
  "cancelled": 5,
  "expired": 0,
  "refunded": 0
}
```

---

### 7. 獲取異常提示

**請求**
```
GET /api/operations-alerts?from=2024-11-20&to=2024-11-30
```

**響應**
```json
[
  {
    "id": "low_utilization",
    "type": "low_utilization",
    "severity": "warning",
    "title": "場地使用率偏低",
    "message": "本期場地使用率僅 50%，建議加強推廣...",
    "timestamp": "2024-11-30T15:35:00Z"
  },
  ...
]
```

**alert type**
- `low_utilization`: 使用率低於 50%
- `high_failures`: 門禁失敗率超過 5%
- `court_gap`: 預約完成率低於 70%
- `no_data`: 設備數據未更新

**severity**
- `info`: 信息性通知
- `warning`: 警告
- `error`: 錯誤

---

### 8. 生成摘要文本

**請求**
```
POST /api/operations-summary
Content-Type: application/json

{
  "metrics": { ... }
}
```

**響應**
```json
{
  "summary": "本期整體預約穩定，完成率良好。尖峰時段使用率接近滿場...",
  "bulletPoints": [
    "預約完成率良好",
    "尖峰時段使用率接近滿場",
    "平日離峰時段有發展空間"
  ]
}
```

---

## 導出功能

### 下載 PDF

**方法**: 客戶端調用
```typescript
downloadPDF({
  metrics: {...},
  trends: [...],
  fromDate: '2024-11-20',
  toDate: '2024-11-30',
  ...
})
```

**文件名格式**: `營運狀況報表_YYYY-MM-DD_YYYY-MM-DD.pdf`

### 導出 CSV

**方法**: 客戶端調用
```typescript
exportCSV({
  metrics: {...},
  trends: [...],
  fromDate: '2024-11-20',
  toDate: '2024-11-30',
  ...
})
```

**文件名格式**: `營運狀況報表_YYYY-MM-DD_YYYY-MM-DD.csv`

### 列印報表

**方法**: 客戶端調用
```typescript
printReport()
```

---

## 錯誤處理

### 常見錯誤

**400 Bad Request**
```json
{
  "error": "Invalid date format. Expected YYYY-MM-DD",
  "code": "INVALID_DATE_FORMAT"
}
```

**403 Forbidden**
```json
{
  "error": "Insufficient permissions. Required: finance",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**500 Internal Server Error**
```json
{
  "error": "Database query failed",
  "code": "INTERNAL_ERROR",
  "requestId": "req_12345"
}
```

---

## 速率限制

- **認證用戶**: 100 請求/分鐘
- **匿名用戶**: 10 請求/分鐘

**頭部響應**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## 緩存策略

- **查詢結果**: 1 小時 TTL
- **頁面數據**: 30 分鐘 TTL
- **異常提示**: 5 分鐘 TTL

使用 `Cache-Control` 頭:
```
Cache-Control: public, max-age=3600
```

---

## 分頁支持

大型數據集支持分頁:

```
GET /api/operations-trends?from=2024-11-01&to=2024-11-30&limit=100&offset=0
```

**參數**
| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| limit | number | 50 | 返回數量 |
| offset | number | 0 | 偏移位置 |

**響應**
```json
{
  "data": [...],
  "total": 450,
  "limit": 100,
  "offset": 0,
  "hasMore": true
}
```

---

## 範例代碼

### JavaScript/TypeScript

```typescript
// 獲取操作指標
const response = await fetch(
  `/api/operations-metrics?from=2024-11-20&to=2024-11-30`,
  { headers: { 'Authorization': `Bearer ${token}` } }
)
const data = await response.json()
```

### Python

```python
import requests

response = requests.get(
  'https://example.com/api/operations-metrics',
  params={'from': '2024-11-20', 'to': '2024-11-30'},
  headers={'Authorization': f'Bearer {token}'}
)
data = response.json()
```

### cURL

```bash
curl -H "Authorization: Bearer {token}" \
  'https://example.com/api/operations-metrics?from=2024-11-20&to=2024-11-30'
```

---

## 更新日誌

| 版本 | 日期 | 更改 |
|------|------|------|
| 1.0.0 | 2024-11-24 | 初始發布 |

---

**最後更新**: 2024-11-24  
**維護人員**: 開發團隊
