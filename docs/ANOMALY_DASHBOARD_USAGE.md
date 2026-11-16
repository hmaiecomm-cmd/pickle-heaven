# 异常统计仪表板使用指南

## 概述

异常统计仪表板提供了设备异常的全面统计分析，包括：
- 异常汇总统计
- 按严重程度分布
- 常见异常类型排行
- 受影响迴路排行
- 7 日趋势图

## 组件使用

### 1. AnomalyDashboard 组件

```tsx
import { AnomalyDashboard } from '@/components/admin/anomaly-dashboard'
import { useAnomalyStats } from '@/hooks/useAnomalyStats'

export function MyPage() {
  const { stats, isLoading } = useAnomalyStats(7) // 过去 7 天

  return (
    <div className="space-y-6">
      <h1>异常统计</h1>
      <AnomalyDashboard stats={stats} isLoading={isLoading} />
    </div>
  )
}
```

### 2. useAnomalyStats Hook

```typescript
function useAnomalyStats(
  days: number = 7,          // 统计天数
  circuitId?: string,         // 可选：特定迴路
  autoRefreshMs: number = 60000 // 自动刷新间隔（毫秒）
): UseAnomalyStatsReturn
```

**返回值**：
```typescript
{
  stats: AnomalyStats | null,    // 统计数据
  isLoading: boolean,             // 加载中
  error: Error | null,            // 错误信息
  refetch: () => Promise<void>    // 手动刷新
}
```

## API 端点

### GET /api/admin/devices/statistics

**查询参数**：
- `days` (可选)：统计天数，默认 7，最大 90
- `circuitId` (可选)：特定迴路编号

**响应示例**：
```json
{
  "success": true,
  "data": {
    "period": {
      "since": "2026-11-09T00:00:00Z",
      "until": "2026-11-16T00:00:00Z",
      "days": 7
    },
    "summary": {
      "total": 42,
      "resolved": 28,
      "acknowledged": 10,
      "pending": 4
    },
    "bySeverity": [
      {
        "severity": "warning",
        "count": 15,
        "percentage": "35.7"
      },
      {
        "severity": "error",
        "count": 20,
        "percentage": "47.6"
      },
      {
        "severity": "critical",
        "count": 7,
        "percentage": "16.7"
      }
    ],
    "byType": [
      {
        "type": "state_mismatch",
        "count": 12,
        "percentage": "28.6"
      },
      // ... 更多异常类型
    ],
    "dailyTrend": [
      {
        "date": "2026-11-09",
        "count": 5
      },
      // ... 每日数据
    ],
    "topAffected": [
      {
        "circuitId": "12",
        "anomalyCount": 8
      },
      // ... 更多受影响迴路
    ]
  },
  "lastUpdated": "2026-11-16T10:30:00Z"
}
```

## 集成示例

### 在现有设备总览页面添加统计板块

```tsx
'use client'

import { DeviceManager } from '@/components/admin/device-manager'
import { AnomalyDashboard } from '@/components/admin/anomaly-dashboard'
import { useAnomalyStats } from '@/hooks/useAnomalyStats'

export default function DevicesPage() {
  const { stats, isLoading } = useAnomalyStats(7)

  return (
    <div className="space-y-6">
      {/* 设备管理主体 */}
      <DeviceManager />

      {/* 异常统计仪表板 */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">异常统计</h2>
        <AnomalyDashboard stats={stats} isLoading={isLoading} />
      </div>
    </div>
  )
}
```

### 特定迴路的统计

```tsx
const { stats, isLoading } = useAnomalyStats(
  14,    // 过去 14 天
  '12'   // 迴路 12
)
```

## 性能优化

### 1. 自动刷新配置

```tsx
// 关闭自动刷新
const { stats, refetch } = useAnomalyStats(7, undefined, 0)

// 自定义刷新间隔（5 分钟）
const { stats } = useAnomalyStats(7, undefined, 300000)

// 手动刷新
await refetch()
```

### 2. 缓存策略

统计 API 支持浏览器缓存，生产环境可配置缓存头：
```typescript
// GET /api/admin/devices/statistics
// Cache-Control: max-age=300 // 5 分钟缓存
```

### 3. 数据库查询优化

- 使用 Prisma `groupBy` 进行聚合查询
- 支持按迴路筛选减少数据量
- 日期范围限制最多 90 天

## 样式定制

### 主题颜色

在 `anomaly-dashboard.tsx` 中修改：
- 严重程度颜色：`bg-red-500`、`bg-orange-500`、`bg-amber-500`
- 强调色：`bg-blue-500`

### 布局调整

组件使用 Tailwind CSS，可通过以下方式自定义：
- 修改 `md:grid-cols-4` 改变卡片列数
- 调整 `p-4` 改变内边距
- 修改 `space-y-4` 改变间距

## 常见问题

### 1. 统计数据延迟

API 端点包含数据库查询，对于大量异常可能需要几秒。
- 考虑在后台预计算统计数据
- 使用缓存加速查询

### 2. 趋势图显示

日期趋势自动填充缺失日期（显示为 0）。

### 3. 实时性

统计数据支持 60 秒自动刷新（可配置）。
结合 WebSocket 推送，可实现准实时统计。

## 后续改进

### Phase 6d 完成后的优化方向

1. **图表库集成**
   - 添加 Chart.js 或 Recharts
   - 更丰富的图表类型

2. **导出功能**
   - CSV 导出
   - PDF 报告生成

3. **异常规则配置**
   - 自定义警告阈值
   - 异常自动升级规则

4. **历史对比**
   - 周/月/年对比
   - 趋势预测

## API 端点代码位置

- 路由：`src/app/api/admin/devices/statistics/route.ts`
- 组件：`src/components/admin/anomaly-dashboard.tsx`
- Hook：`src/hooks/useAnomalyStats.ts`

---

**文档更新**：2026-11-16  
**版本**：Phase 6d
