# 🔗 選項 C：系統集成 - 完整指南

**狀態：** 規劃與實現  
**預計時間：** 2-3 小時  
**難度：** 高  
**負責人：** 架構團隊  

---

## 🏗️ 系統架構概覽

```
┌─────────────────────────────────────────────────────┐
│               用戶界面層 (Frontend)                  │
│          (Next.js 15 + React Server Components)    │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│            後台管理系統 (Backend) V4                  │
│     (認證、權限、邀請、審計日誌)                    │
└────────────────┬─────────────────────────────────────┘
                 │
     ┌───────────┼───────────┬──────────────┐
     │           │           │              │
     ▼           ▼           ▼              ▼
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 電力控制 │ │ 門禁系統 │ │LINE通知  │ │ 預約系統 │
│ (MQTT)  │ │(MQTT)   │ │(Push)   │ │(数据库) │
└─────────┘ └─────────┘ └──────────┘ └──────────┘
```

---

## 📋 集成需求分析

### C1：電力控制系統集成

**已存在系統：**
- 18 路迴路控制
- MQTT 通信
- Watchdog 監控
- 管理 UI

**集成目標：**
1. 後台管理員可查看電力狀態
2. 授權的管理員可遠程控制迴路
3. 電力事件自動記錄到審計日誌
4. 權限：`manage_power` 允許電力管理

**實現步驟：**

#### C1.1 創建電力控制 API 網關

```typescript
// src/lib/power-control-client.ts

import mqtt from 'mqtt';

interface PowerCircuit {
  id: number;
  name: string;
  status: 'on' | 'off' | 'error';
  current?: number;
  voltage?: number;
}

interface PowerStatus {
  timestamp: Date;
  circuits: PowerCircuit[];
  totalCurrent: number;
}

export class PowerControlClient {
  private client: mqtt.MqttClient;
  private status: Map<number, PowerCircuit> = new Map();

  constructor() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('message', (topic: string, message: Buffer) => {
      const data = JSON.parse(message.toString());
      this.updateCircuitStatus(data);
    });

    // 訂閱所有電力話題
    this.client.subscribe('power/circuits/+/status');
    this.client.subscribe('power/system/status');
  }

  private updateCircuitStatus(data: any): void {
    const circuitId = data.id;
    this.status.set(circuitId, {
      id: circuitId,
      name: data.name || `Circuit ${circuitId}`,
      status: data.status,
      current: data.current,
      voltage: data.voltage,
    });
  }

  async getStatus(): Promise<PowerStatus> {
    return {
      timestamp: new Date(),
      circuits: Array.from(this.status.values()),
      totalCurrent: Array.from(this.status.values())
        .reduce((sum, c) => sum + (c.current || 0), 0),
    };
  }

  async toggleCircuit(circuitId: number, enabled: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const topic = `power/circuits/${circuitId}/command`;
      const message = JSON.stringify({ action: enabled ? 'on' : 'off' });
      this.client.publish(topic, message, () => resolve(true));
    });
  }
}

export const powerClient = new PowerControlClient();
```

#### C1.2 添加電力控制 API 路由

```typescript
// src/app/api/admin/power/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin-auth';
import { powerClient } from '@/lib/power-control-client';

export async function GET(req: NextRequest) {
  await requirePermission(req, 'manage_power');

  try {
    const status = await powerClient.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get power status' },
      { status: 500 }
    );
  }
}
```

```typescript
// src/app/api/admin/power/circuits/[id]/toggle/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, logAuditEvent } from '@/lib/admin-auth';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { powerClient } from '@/lib/power-control-client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requirePermission(req, 'manage_power');

  const admin = await getCurrentAdmin(req);
  const circuitId = parseInt(params.id);
  const { enabled } = await req.json();

  try {
    const result = await powerClient.toggleCircuit(circuitId, enabled);

    // 審計日誌
    await logAuditEvent({
      adminId: admin?.id || '',
      action: 'power_circuit_toggle',
      resource: `circuit_${circuitId}`,
      status: result ? 'success' : 'failed',
      changes: JSON.stringify({ circuitId, newState: enabled ? 'on' : 'off' }),
    });

    return NextResponse.json({ success: result });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to toggle circuit' },
      { status: 500 }
    );
  }
}
```

---

### C2：門禁系統集成

**已存在系統：**
- 12 步訪問流程
- Raspberry Pi 適配器
- MQTT 監聽

**集成目標：**
1. 後台管理員可查看進出記錄
2. 授權的管理員可啟用/禁用卡片
3. 訪問事件自動記錄
4. 權限：`manage_access` 允許門禁管理

#### C2.1 門禁數據同步

```typescript
// src/lib/door-access-client.ts

interface AccessRecord {
  id: string;
  cardId: string;
  timestamp: Date;
  action: 'enter' | 'exit' | 'denied';
  location: string;
  success: boolean;
}

interface CardStatus {
  cardId: string;
  holderName: string;
  enabled: boolean;
  lastUsed: Date;
  accessLevel: 'basic' | 'advanced' | 'admin';
}

export class DoorAccessClient {
  private records: AccessRecord[] = [];

  async getAccessRecords(
    limit: number = 100,
    cardId?: string
  ): Promise<AccessRecord[]> {
    let filtered = this.records;
    if (cardId) {
      filtered = filtered.filter(r => r.cardId === cardId);
    }
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getCardStatus(cardId: string): Promise<CardStatus | null> {
    // 實現從 Pi 讀取卡片狀態
    return null;
  }

  async disableCard(cardId: string): Promise<boolean> {
    // 發送 MQTT 命令禁用卡片
    return true;
  }

  async enableCard(cardId: string): Promise<boolean> {
    // 發送 MQTT 命令啟用卡片
    return true;
  }
}

export const doorAccessClient = new DoorAccessClient();
```

---

### C3：LINE 通知系統集成

**已存在系統：**
- 預約成功通知
- 開打提醒
- 取消通知

**集成目標：**
1. 系統事件通知管理員
2. 告警通知（電力故障、門禁異常等）
3. 日常提醒

#### C3.1 LINE 通知中心

```typescript
// src/lib/line-notification-hub.ts

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

export interface LineNotification {
  type: NotificationType;
  title: string;
  message: string;
  details?: Record<string, string>;
}

export class LineNotificationHub {
  async sendToAdmin(adminId: string, notification: LineNotification): Promise<boolean> {
    // 獲取管理員的 LINE User ID
    // 發送通知
    return true;
  }

  async sendToRole(role: string, notification: LineNotification): Promise<number> {
    // 發送給特定角色的所有管理員
    // 返回發送成功數量
    return 0;
  }

  async sendPowerAlert(circuitId: number, status: 'on' | 'off' | 'error'): Promise<void> {
    await this.sendToRole('OWNER', {
      type: status === 'error' ? NotificationType.ERROR : NotificationType.INFO,
      title: '電力狀態更新',
      message: `迴路 ${circuitId} 狀態: ${status}`,
    });
  }

  async sendAccessAlert(cardId: string, action: 'denied' | 'unauthorized'): Promise<void> {
    await this.sendToRole('OWNER', {
      type: NotificationType.WARNING,
      title: '門禁告警',
      message: `卡片 ${cardId} ${action === 'denied' ? '被拒絕' : '未授權'}`,
    });
  }
}

export const lineNotificationHub = new LineNotificationHub();
```

---

### C4：跨系統權限映射

**目標：** 統一管理所有系統的權限

#### C4.1 擴展權限系統

```typescript
// src/lib/admin-permissions.ts (更新)

export const PERMISSIONS = {
  // 後台管理
  manage_admins: { role: 'admin', description: '管理員管理' },
  view_audit: { role: 'admin', description: '查看審計日誌' },

  // 場館管理
  manage_courts: { role: 'manager', description: '場館管理' },
  manage_bookings: { role: 'manager', description: '預約管理' },
  manage_members: { role: 'manager', description: '會員管理' },

  // 電力控制
  view_power: { role: 'staff', description: '查看電力狀態' },
  manage_power: { role: 'manager', description: '控制電力迴路' },

  // 門禁控制
  view_access: { role: 'staff', description: '查看進出記錄' },
  manage_access: { role: 'manager', description: '管理訪問卡片' },

  // 財務
  manage_finance: { role: 'finance', description: '財務管理' },
  view_reports: { role: 'finance', description: '報告查看' },

  // 設備維護
  manage_maintenance: { role: 'maintenance', description: '設備維護' },
} as const;

export function getRolePermissions(role: string): string[] {
  const mapping: Record<string, string[]> = {
    OWNER: Object.keys(PERMISSIONS),
    MANAGER: [
      'manage_courts', 'manage_bookings', 'manage_members',
      'manage_power', 'manage_access', 'view_power', 'view_access'
    ],
    STAFF: ['view_power', 'view_access', 'manage_bookings'],
    FINANCE: ['manage_finance', 'view_reports', 'view_audit'],
    MAINTENANCE: ['manage_maintenance', 'view_power', 'view_access'],
  };
  return mapping[role] || [];
}
```

---

## 🔄 集成工作流程

### 步驟 1：電力控制系統集成（45 分鐘）
- [ ] 創建 PowerControlClient
- [ ] 實現電力狀態 API
- [ ] 實現迴路控制 API
- [ ] 添加審計日誌
- [ ] 前端電力管理頁面
- [ ] 測試 MQTT 連接

### 步驟 2：門禁系統集成（45 分鐘）
- [ ] 創建 DoorAccessClient
- [ ] 實現訪問記錄 API
- [ ] 實現卡片管理 API
- [ ] 添加審計日誌
- [ ] 前端訪問記錄頁面
- [ ] 測試 Pi 適配器

### 步驟 3：LINE 通知集成（30 分鐘）
- [ ] 創建 LineNotificationHub
- [ ] 實現管理員通知
- [ ] 實現角色通知
- [ ] 實現告警通知
- [ ] 前端通知設置
- [ ] 測試推送

### 步驟 4：權限統一（30 分鐘）
- [ ] 更新權限矩陣
- [ ] 修改 API 守衛
- [ ] 更新前端菜單
- [ ] 測試權限邏輯
- [ ] 審計日誌驗證

---

## 📊 集成檢查清單

### 數據同步
- [ ] 電力迴路狀態每秒更新
- [ ] 門禁記錄實時同步
- [ ] 無數據遺漏

### API 可用性
- [ ] 所有集成 API 都返回 200 OK
- [ ] 錯誤情況返回適當的狀態碼
- [ ] API 響應時間 < 500ms

### 權限控制
- [ ] 只有授權用戶可訪問
- [ ] 操作被正確記錄
- [ ] 無權限用戶被拒絕

### 系統穩定性
- [ ] 沒有記憶體洩漏
- [ ] MQTT 連接穩定
- [ ] 進程不會意外退出

---

## 🎯 集成成功指標

| 指標 | 目標 | 驗證方法 |
|------|------|--------|
| API 延遲 | < 500ms | 使用 curl -w "%{time_total}" |
| 數據一致性 | 100% | 對比前後端數據 |
| 系統可用性 | > 99.9% | 24 小時監控 |
| 權限準確率 | 100% | 每個角色都測試 |

---

## 🚨 風險評估

| 風險 | 影響 | 緩解措施 |
|------|------|--------|
| MQTT 連接中斷 | 無法控制設備 | 實現自動重連 |
| 數據不一致 | 顯示錯誤狀態 | 定期同步驗證 |
| 權限配置錯誤 | 安全風險 | 代碼審查 + 測試 |
| 性能降低 | 用戶體驗差 | 添加緩存層 |

---

**下一步：實現上述集成或繼續選項 D（測試 & QA）** 🔗
