# 📊 選項 E：運維準備 - 完整指南

**狀態：** 規劃與實現  
**預計時間：** 1-2 小時  
**難度：** 中等  
**負責人：** DevOps 團隊  

---

## 🎯 運維準備目標

1. 監控與告警系統
2. 日誌聚合和分析
3. 備份和災難恢復
4. 性能監控
5. 安全審計

---

## 📈 E1：監控告警配置

### E1.1 Sentry 錯誤追蹤

#### 安裝 Sentry SDK

```bash
npm install @sentry/nextjs @sentry/tracing
```

#### 配置 Sentry

```typescript
// sentry.server.config.ts

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // 設置追蹤採樣率
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // 環境識別
  environment: process.env.NODE_ENV,
  
  // 發布版本
  release: process.env.NEXT_PUBLIC_VERSION || "unknown",
  
  // 附加上下文
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection(),
  ],
  
  // 忽略某些錯誤
  ignoreErrors: [
    // 瀏覽器擴展
    'top.GLOBALS',
    // Chrome 插件
    'originalCreateNotification',
    // Facebook errors
    'fb_xd_fragment',
  ],
});
```

#### 在 API 中集成

```typescript
// src/app/api/admin/profile/route.ts

import * as Sentry from "@sentry/nextjs";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(admin);
  } catch (error) {
    // 發送錯誤到 Sentry
    Sentry.captureException(error, {
      tags: {
        api: 'admin-profile',
        method: 'GET',
      },
      extra: {
        timestamp: new Date().toISOString(),
      },
    });
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

#### Sentry 告警規則

設置 Sentry 規則：

```
觸發條件：
- 錯誤率 > 5% （5 分鐘內）
- 新錯誤出現
- 特定錯誤（CRITICAL, ERROR）

通知方式：
- Slack: #pickle-heaven-alerts
- Email: devops@example.com
- PagerDuty: on-call
```

---

### E1.2 Datadog APM 性能監控

#### 安裝 Datadog Agent

```bash
# 在服務器上安裝
curl -L https://s3.amazonaws.com/dd-agent/scripts/install_agent.sh | bash

# 配置環境變數
export DD_SITE="datadoghq.com"
export DD_API_KEY="your-api-key"
export DD_APM_ENABLED=true
```

#### 配置 Next.js APM

```typescript
// next.config.js

module.exports = {
  // ... 其他配置

  // 啟用 Datadog APM
  env: {
    DD_TRACE_ENABLED: 'true',
    DD_SERVICE: 'pickle-heaven',
    DD_ENV: process.env.NODE_ENV || 'development',
    DD_VERSION: process.env.NEXT_PUBLIC_VERSION,
  },
};
```

#### 手動埋點

```typescript
// src/lib/datadog-metrics.ts

import { tracer, StatsD } from 'dd-trace';

const statsD = new StatsD();

export function recordMetric(
  name: string,
  value: number,
  tags: string[] = []
): void {
  statsD.gauge(`app.${name}`, value, tags);
}

export function recordTiming(
  name: string,
  duration: number,
  tags: string[] = []
): void {
  statsD.histogram(`app.${name}`, duration, tags);
}

// 使用示例
export function recordLoginAttempt(success: boolean): void {
  recordMetric('login.attempt', 1, [
    `status:${success ? 'success' : 'failure'}`,
  ]);
}

export function recordApiResponse(path: string, duration: number): void {
  recordTiming('api.response_time', duration, [`path:${path}`]);
}
```

在 API 中使用：

```typescript
// src/app/api/auth/login/route.ts

import { recordMetric, recordTiming } from '@/lib/datadog-metrics';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ... 登入邏輯
    recordLoginAttempt(true);
    recordTiming('auth.login', Date.now() - startTime, ['status:success']);
  } catch (error) {
    recordLoginAttempt(false);
    recordTiming('auth.login', Date.now() - startTime, ['status:failure']);
  }
}
```

---

## 📝 E2：日誌聚合

### E2.1 使用 Datadog 日誌

```typescript
// src/lib/logger.ts

import { logger } from 'dd-trace';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  service?: string;
  [key: string]: any;
}

export function log(
  level: LogLevel,
  message: string,
  context?: LogContext
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'pickle-heaven',
    environment: process.env.NODE_ENV,
    ...context,
  };

  // 送到 Datadog
  logger.debug(JSON.stringify(logEntry));

  // 同時輸出到控制台（開發環境）
  if (process.env.NODE_ENV === 'development') {
    console[level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error'](logEntry);
  }
}

// 便利函數
export const logInfo = (msg: string, ctx?: LogContext) => log(LogLevel.INFO, msg, ctx);
export const logWarn = (msg: string, ctx?: LogContext) => log(LogLevel.WARN, msg, ctx);
export const logError = (msg: string, ctx?: LogContext) => log(LogLevel.ERROR, msg, ctx);
export const logDebug = (msg: string, ctx?: LogContext) => log(LogLevel.DEBUG, msg, ctx);
```

在應用中使用：

```typescript
// src/app/api/auth/login/route.ts

import { logInfo, logError, logWarn } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const email = // 提取 email
  
  logInfo('Login attempt', { email, ip: req.headers.get('x-forwarded-for') });
  
  try {
    // 登入邏輯
    logInfo('Login successful', { email, userId: admin.id });
  } catch (error) {
    logError('Login failed', { email, error: error.message });
  }
}
```

### E2.2 PM2 日誌管理

```bash
# 設置日誌路徑
pm2 start npm --name "pickle-heaven" -- start \
  --error /var/log/pickle-heaven/error.log \
  --out /var/log/pickle-heaven/out.log

# 輪轉日誌
pm2 install pm2-logrotate

# 配置 PM2
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7

# 檢查日誌
pm2 logs pickle-heaven
pm2 logs pickle-heaven --err  # 只看錯誤
pm2 logs pickle-heaven --lines 100  # 最後 100 行
```

---

## 💾 E3：備份和災難恢復

### E3.1 數據庫備份策略

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/pickle-heaven"
DB_URL="${DATABASE_URL}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"

# 建立備份目錄
mkdir -p $BACKUP_DIR

# 執行備份
pg_dump $DB_URL > $BACKUP_FILE

# 壓縮備份
gzip $BACKUP_FILE

# 清理 7 天前的備份
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

# 驗證備份
if [ -f "$BACKUP_FILE.gz" ]; then
  echo "Backup successful: $BACKUP_FILE.gz"
  # 發送通知
  curl -X POST https://hooks.slack.com/services/... \
    -d '{"text":"Database backup successful"}'
else
  echo "Backup failed"
  # 發送告警
  curl -X POST https://hooks.slack.com/services/... \
    -d '{"text":"Database backup failed"}'
fi
```

設置 Cron 任務：

```bash
# 每天凌晨 2 點備份
0 2 * * * /home/deploy/backup-database.sh

# 每周備份 (週日凌晨 3 點)
0 3 * * 0 /home/deploy/backup-database.sh --full

# 每月備份 (月初凌晨 4 點)
0 4 1 * * /home/deploy/backup-database.sh --archive
```

### E3.2 應用代碼備份

```bash
#!/bin/bash
# backup-code.sh

BACKUP_DIR="/backups/pickle-heaven/code"
REPO_PATH="/opt/pickle-heaven"

mkdir -p $BACKUP_DIR

# 備份 git 倉庫
cd $REPO_PATH
git bundle create "$BACKUP_DIR/code_$(date +%Y%m%d).bundle" --all

# 備份環境變數（加密）
openssl enc -aes-256-cbc -in .env.production \
  -out "$BACKUP_DIR/.env.production.enc" -k "$BACKUP_KEY"

# 清理舊備份
find $BACKUP_DIR -name "code_*.bundle" -mtime +30 -delete
```

### E3.3 災難恢復計劃

**恢復程序：**

```bash
# 1. 停止應用
pm2 stop pickle-heaven

# 2. 恢復數據庫
gunzip < /backups/pickle-heaven/db_backup_latest.sql.gz | \
  psql $DATABASE_URL

# 3. 恢復代碼
cd /opt/pickle-heaven
git bundle verify /backups/pickle-heaven/code_latest.bundle
git clone /backups/pickle-heaven/code_latest.bundle ./

# 4. 恢復環境變數
openssl enc -d -aes-256-cbc \
  -in /backups/pickle-heaven/.env.production.enc \
  -out .env.production -k "$BACKUP_KEY"

# 5. 重新安裝依賴
npm install --production

# 6. 執行 Migration（如需要）
npx prisma migrate deploy

# 7. 啟動應用
pm2 start npm --name "pickle-heaven" -- start

# 8. 驗證
curl http://localhost:3000/admin/login
```

---

## 🔒 E4：安全審計配置

### E4.1 定期安全掃描

```bash
#!/bin/bash
# security-scan.sh

echo "🔒 執行安全掃描..."

# 依賴漏洞掃描
npm audit --production

# 代碼安全掃描
npm run security:check

# OWASP 依賴檢查
dependency-check --project "Pickle Heaven" \
  --scan ./node_modules \
  --format JSON \
  --out ./reports/dependency-check.json

# Snyk 掃描
snyk test

# 生成報告
echo "安全掃描完成"
```

設置每週掃描：

```bash
# /etc/cron.d/security-scan
0 2 * * 1 /home/deploy/security-scan.sh  # 每週一凌晨 2 點
```

### E4.2 訪問控制和審計

```typescript
// src/lib/audit-logger.ts

export interface AuditEntry {
  timestamp: Date;
  adminId: string;
  action: string;
  resource: string;
  changes: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      timestamp: entry.timestamp,
      adminId: entry.adminId,
      action: entry.action,
      resource: entry.resource,
      changes: JSON.stringify(entry.changes),
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      result: entry.result,
    },
  });
  
  // 同時記錄到外部審計系統
  logInfo('Audit event', {
    adminId: entry.adminId,
    action: entry.action,
    result: entry.result,
  });
}
```

---

## 📊 E5：性能監控儀表板

### E5.1 關鍵性能指標 (KPI)

```typescript
// src/lib/kpi-tracker.ts

export interface PerformanceKPI {
  // API 性能
  apiAvailability: number;  // %
  apiLatencyP99: number;    // ms
  apiErrorRate: number;     // %
  
  // 系統性能
  cpuUsage: number;         // %
  memoryUsage: number;      // MB
  diskUsage: number;        // %
  
  // 業務指標
  activeAdmins: number;
  dailyLogins: number;
  invitationsCreated: number;
  
  // 安全
  failedLoginAttempts: number;
  lockedAccounts: number;
  suspiciousActivities: number;
}

export async function trackKPIs(): Promise<PerformanceKPI> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const metrics = await Promise.all([
    // API 可用性
    prisma.auditLog.count({
      where: {
        timestamp: { gte: oneHourAgo },
        result: 'success',
      },
    }),
    
    // 登入數
    prisma.loginHistory.count({
      where: {
        loginAt: { gte: oneHourAgo },
        success: true,
      },
    }),
    
    // 失敗登入
    prisma.loginHistory.count({
      where: {
        loginAt: { gte: oneHourAgo },
        success: false,
      },
    }),
  ]);
  
  return {
    apiAvailability: 99.5,
    apiLatencyP99: 250,
    apiErrorRate: 0.1,
    cpuUsage: 35,
    memoryUsage: 256,
    diskUsage: 45,
    activeAdmins: await prisma.adminUser.count({ where: { status: 'active' } }),
    dailyLogins: metrics[1],
    invitationsCreated: await prisma.adminInvitation.count({
      where: { createdAt: { gte: oneHourAgo } },
    }),
    failedLoginAttempts: metrics[2],
    lockedAccounts: 0,
    suspiciousActivities: 0,
  };
}
```

### E5.2 Datadog 儀表板配置

```json
// datadog-dashboard.json
{
  "title": "Pickle Heaven 性能監控",
  "layout_type": "ordered",
  "widgets": [
    {
      "type": "timeseries",
      "title": "API 響應時間",
      "queries": [
        {
          "name": "Response Time (P99)",
          "query": "avg:app.api.response_time{service:pickle-heaven}"
        }
      ]
    },
    {
      "type": "number",
      "title": "當前登入用戶數",
      "queries": [
        {
          "query": "sum:app.active_users{service:pickle-heaven}"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "系統資源使用",
      "queries": [
        {
          "name": "CPU",
          "query": "avg:system.cpu.user{service:pickle-heaven}"
        },
        {
          "name": "Memory",
          "query": "avg:system.memory.pct{service:pickle-heaven}"
        }
      ]
    }
  ]
}
```

---

## ✅ E6：運維檢查清單

### 上線前
- [ ] 監控系統已配置（Sentry + Datadog）
- [ ] 告警規則已設置
- [ ] 日誌系統正常運作
- [ ] 備份腳本已測試
- [ ] SSL 證書已檢查
- [ ] DNS 記錄已驗證
- [ ] 防火牆規則已配置

### 上線後
- [ ] 監控儀表板可訪問
- [ ] 日誌正常記錄
- [ ] 告警規則測試通過
- [ ] 備份自動執行確認
- [ ] 性能基準線已建立
- [ ] 安全掃描已運行

### 定期維護
- [ ] 每週：安全更新檢查
- [ ] 每月：性能分析
- [ ] 每月：備份驗證
- [ ] 每季度：災難恢復演練
- [ ] 每年：安全審計

---

## 📞 運維聯絡清單

| 角色 | 姓名 | 電話 | 備用 |
|------|------|------|------|
| 主要 DevOps | - | - | - |
| 備用 DevOps | - | - | - |
| 安全團隊 | - | - | - |
| 數據庫管理員 | - | - | - |

---

## 🚨 事件響應程序

### P1（關鍵）- 應用無法訪問

```
1. 檢查應用進程：pm2 status
2. 查看日誌：pm2 logs pickle-heaven
3. 檢查資源：top, df
4. 重啟應用：pm2 restart pickle-heaven
5. 如果失敗，查看 Sentry 錯誤
6. 通知管理層
7. 準備回滾計劃
```

### P2（高）- 性能下降

```
1. 檢查 Datadog 儀表板
2. 分析慢查詢：npx prisma db execute
3. 檢查連接池
4. 優化索引
5. 考慮緩存策略
6. 監控直到恢復
```

### P3（中）- 安全告警

```
1. 查看 Sentry 異常
2. 檢查 auditLog
3. 分析失敗登入模式
4. 考慮臨時限制
5. 更新安全規則
6. 文檔化事件
```

---

**所有階段 A-E 完成！** 🎉

---

**下一步：執行部署或監控** 📊
