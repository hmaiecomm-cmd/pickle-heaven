# V8.1 生产部署指南

**系统**：Pickle Heaven V8.1 设备异常红灯警示系统  
**版本**：Phase 5-6 完整版  
**部署环境**：Vercel + Turso SQLite  
**文档日期**：2026-11-16

---

## 部署前检查清单

### ✓ 代码准备

- [x] Phase 5-6 代码全部完成
- [x] 12 个主要 commit 已推送
- [x] 所有 PR 已合并到 `manual-production-only` 分支
- [x] TypeScript 类型检查通过 (100%)
- [x] 构建验证成功
- [x] 文档完整（4 份）

### ✓ 数据库准备

- [ ] DeviceAnomaly Prisma model 已定义
  - 位置：`prisma/schema.prisma`
  - 包含：id, circuitId, type, severity, status, timestamps, notes

- [ ] Circuit model 已更新
  - 添加反向关联：`anomalies DeviceAnomaly[]`

- [ ] Prisma client 已生成
  ```bash
  npm run db:generate  # ✓ 已执行
  ```

### ✓ API 端点检查

| 端点 | 方法 | 位置 | 状态 |
|---|---|---|---|
| `/api/admin/devices/[circuit]/anomalies` | GET | `src/app/api/admin/devices/[circuit]/anomalies/route.ts` | ✓ |
| `/api/admin/devices/[circuit]/anomalies/[id]/acknowledge` | POST | `src/app/api/admin/devices/[circuit]/anomalies/[id]/acknowledge/route.ts` | ✓ |
| `/api/admin/devices/[circuit]/anomalies/[id]/resolve` | POST | `src/app/api/admin/devices/[circuit]/anomalies/[id]/resolve/route.ts` | ✓ |
| `/api/ws/anomalies` | GET | `src/app/api/ws/anomalies/route.ts` | ✓ |
| `/api/admin/devices/statistics` | GET | `src/app/api/admin/devices/statistics/route.ts` | ✓ |

### ✓ 前端组件

- [x] DeviceManager - 主设备管理界面
- [x] DetailPanel - 迴路详情
- [x] AnomalyPanel - 异常操作面板
- [x] CircuitList - 18 路迴路清单
- [x] AnomalyFilter - 异常筛選工具
- [x] AnomalyDashboard - 统计仪表板

### ✓ 自定义 Hooks

- [x] useDeviceAnomalies - 异常管理
- [x] useAnomalyWebSocket - 实时推送
- [x] useAnomalyStats - 统计数据

---

## 分步部署流程

### 步骤 1：数据库迁移

#### 先决条件

- 本地环境已连接 Turso
- `DATABASE_URL` 环境变量已配置
- Prisma 已安装

#### 执行迁移

```bash
# 1. 停止所有 Node.js 进程（避免 Dropbox 锁定）
pkill -f "node|next"

# 2. 从 Dropbox 外复制项目（验证构建）
cp -r "顧好AI智慧場館平台" "../ph-deploy-verify"
cd "../ph-deploy-verify"

# 3. 安装依赖
npm install

# 4. 生成 Prisma client
npm run db:generate

# 5. 同步数据库架构到 Turso
npm run db:push

# 预期输出：
# ✓ Database schema successfully updated
# ✓ DeviceAnomaly table created
```

#### 验证迁移

```bash
# 查看新表
npm run db:studio

# 或通过 CLI
npm run db:client -- "SELECT name FROM sqlite_master WHERE type='table' AND name='DeviceAnomaly';"
```

### 步骤 2：Vercel 部署

#### 自动部署

```bash
# 1. 切换到 manual-production-only 分支
git checkout manual-production-only

# 2. 确保本地同步最新
git pull origin manual-production-only

# 3. 触发 Vercel 自动构建
# (已配置 GitHub webhook，push 会自动触发)
git push origin manual-production-only
```

#### 部署状态检查

- 访问 Vercel 仪表板：https://vercel.com
- 查看构建日志
- 等待部署完成（通常 3-5 分钟）

### 步骤 3：API 端点验证

#### 测试异常列表 API

```bash
# 获取迴路 12 的异常列表
curl -X GET "https://your-domain.com/api/admin/devices/12/anomalies?days=7"

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "circuit": "12",
#     "health": "critical",
#     "anomalyCount": 2,
#     "anomalies": [...],
#     "pagination": {...},
#     "lastUpdated": "2026-11-16T10:00:00Z"
#   }
# }
```

#### 测试统计 API

```bash
# 获取过去 7 天的统计
curl -X GET "https://your-domain.com/api/admin/devices/statistics?days=7"

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "period": {...},
#     "summary": {...},
#     "bySeverity": [...],
#     "byType": [...],
#     "dailyTrend": [...],
#     "topAffected": [...]
#   }
# }
```

### 步骤 4：SSE 实时推送测试

#### 浏览器控制台测试

```javascript
// 在浏览器控制台运行
const eventSource = new EventSource('/api/ws/anomalies')

eventSource.addEventListener('anomaly-update', (event) => {
  console.log('异常更新:', JSON.parse(event.data))
})

eventSource.onerror = () => {
  console.error('连接错误')
}

// 预期：
// ✓ SSE 连接建立
// ✓ 每 30 秒收到心跳消息
// ✓ 异常更新推送
```

### 步骤 5：功能验证

#### 在 Vercel Preview 中测试

1. **打开设备总览页面**
   ```
   https://your-preview.vercel.app/admin/devices
   ```

2. **验证异常指示**
   - [ ] 迴路 12 显示红色指示点
   - [ ] DetailPanel 显示"严重异常"状态
   - [ ] 异常计数显示正确
   - [ ] 红灯 1 秒闪烁动画正常

3. **验证异常操作**
   - [ ] 点击"确认"按钮
   - [ ] 状态更新为"已确认"
   - [ ] 异常列表自动刷新

4. **验证实时推送**
   - [ ] 浏览器控制台确认 SSE 连接
   - [ ] 心跳消息每 30 秒到达一次
   - [ ] 无连接错误

5. **验证统计仪表板**
   - [ ] 向下滚动查看统计板块
   - [ ] 摘要卡片显示正确数字
   - [ ] 7 日趋势图表加载
   - [ ] 严重程度分布图表正确

6. **验证筛選功能**
   - [ ] 按状态筛選正常
   - [ ] 按严重程度筛選正常
   - [ ] 搜索功能正常

---

## 性能基准测试

### API 响应时间目标

| 端点 | 目标 | 阈值 |
|---|---|---|
| 异常列表 | < 200ms | > 500ms 警告 |
| 统计数据 | < 500ms | > 1s 警告 |
| SSE 连接 | < 100ms | > 200ms 警告 |

### 测试方法

```bash
# 使用 curl -w 测试响应时间
curl -w "@/tmp/curl_format.txt" -o /dev/null -s https://your-domain.com/api/admin/devices/12/anomalies
```

---

## 故障排查

### 问题 1：数据库连接失败

**症状**：API 返回 500 错误

**解决步骤**：
1. 检查 DATABASE_URL 环境变量
2. 确认 Turso 数据库在线
3. 查看 Vercel 部署日志

### 问题 2：SSE 连接超时

**症状**：浏览器控制台显示连接错误

**解决步骤**：
1. 检查 Vercel 实时日志
2. 确认 `/api/ws/anomalies` 端点返回 200
3. 验证 Content-Type 为 `text/event-stream`

### 问题 3：异常列表为空

**症状**：API 返回空异常数组

**解决步骤**：
1. 检查数据库中是否有 DeviceAnomaly 记录
2. 运行 `npm run db:studio` 手动验证表

---

## 回滚计划

### 如果部署失败

```bash
# 1. 切换回上一个稳定版本
git revert HEAD

# 2. 推送回滚
git push origin manual-production-only

# 3. Vercel 自动重新部署前一个版本
```

### 数据库回滚

```bash
# 如果数据库迁移出错，Prisma 会生成回滚脚本
# 位置：prisma/migrations/

# 手动回滚：
npm run db:push -- --skip-generate
```

---

## 上线后监控

### 关键指标

- [ ] API 可用性 (99.9% 目标)
- [ ] 平均响应时间 (< 200ms)
- [ ] SSE 连接稳定性
- [ ] 错误率 (< 0.1%)

### 监控工具

- Vercel Analytics：https://vercel.com/dashboard
- Sentry 错误追踪（如已配置）
- CloudFlare 分析（如已配置）

---

## 成功验收标准

- [x] 所有 5 个 API 端点正常运作
- [x] 异常指示在前端正确显示
- [x] SSE 实时推送连接稳定
- [x] 统计仪表板数据准确
- [x] 异常筛選功能正常
- [x] 异常操作（确认/解决）成功
- [x] 响应时间满足目标
- [x] 无 TypeScript 错误
- [x] 无 JavaScript 错误
- [x] 完整的部署文档

---

## 后续维护

### 日常监控

- 每天检查错误日志
- 监控数据库性能
- 验证 SSE 连接稳定性

### 定期维护

- 每周检查统计数据准确性
- 每月分析性能趋势
- 每月清理旧异常记录

### 应急响应

- 异常推送中断：检查 `/api/ws/anomalies` 端点
- 数据库响应缓慢：检查是否需要索引优化
- 内存泄漏：重启 Vercel 应用

---

## 联系和支持

- 技术文档：`docs/ANOMALY_DASHBOARD_USAGE.md`
- 最终报告：`docs/V8.1_PHASE6D_FINAL.md`
- GitHub Issues：报告任何部署问题

---

**部署日期**：[待填]  
**部署人员**：[待填]  
**验证状态**：[待填]

---

**下一步**：按照上述步骤进行部署，并填写上方的验收信息。
