# Pickleball Paradise Phase 1 MVP 实现计划

**项目目标**：建立完整的Owner Admin Portal，所有页面使用模拟数据。
**总预计时间**：3-4天
**系统模式**：SYSTEM_MODE=MOCK

---

## 📋 项目分解

### **PHASE 1A：基础架构 & 通用组件**（第1天上午）

#### 1.1 数据模型与类型定义
- 📄 `src/lib/models.ts` - 集中定义所有TypeScript模型
  ```typescript
  - Member
  - Court
  - Reservation (支持Court/Event/Coach三种类型)
  - Event
  - Coach
  - Payment
  - Revenue
  - Invoice
  - Receipt
  - Expense
  - Session
  - Device
  - AIEvent
  ```

**工作量**：2小时

#### 1.2 模拟数据系统
- 📄 `src/lib/mock-data/index.ts` - 主入口
- 📄 `src/lib/mock-data/courts.ts` - 模拟球场数据
- 📄 `src/lib/mock-data/members.ts` - 模拟会员数据
- 📄 `src/lib/mock-data/reservations.ts` - 模拟预约数据
- 📄 `src/lib/mock-data/events.ts` - 模拟活动数据
- 📄 `src/lib/mock-data/coaches.ts` - 模拟教练数据
- 📄 `src/lib/mock-data/payments.ts` - 模拟支付数据
- 📄 `src/lib/mock-data/revenue.ts` - 模拟收入数据
- 📄 `src/lib/mock-data/invoices.ts` - 模拟发票数据
- 📄 `src/lib/mock-data/receipts.ts` - 模拟收据数据
- 📄 `src/lib/mock-data/expenses.ts` - 模拟费用数据
- 📄 `src/lib/mock-data/devices.ts` - 模拟设备数据
- 📄 `src/lib/mock-data/ai-events.ts` - 模拟AI事件数据

**工作量**：3小时

#### 1.3 API占位符合约
- 📄 `src/lib/api-service.ts` - 集中管理所有API调用
  ```typescript
  - getReservations()
  - getEvents()
  - getCoaches()
  - getPayments()
  - getRevenue()
  - getInvoices()
  - getReceipts()
  - getExpenses()
  - getReports()
  - getDevices()
  - getAIEvents()
  - postAIChat()
  - postOCRScan()
  - postDeviceAction()
  ```

**工作量**：2小时

#### 1.4 通用UI组件
- 📄 `src/components/common/KPICard.tsx` - KPI卡片
- 📄 `src/components/common/ChartCard.tsx` - 图表容器
- 📄 `src/components/common/DataTable.tsx` - 通用表格
- 📄 `src/components/common/StatusBadge.tsx` - 状态徽章
- 📄 `src/components/common/EmptyState.tsx` - 空数据状态
- 📄 `src/components/common/LoadingState.tsx` - 加载状态
- 📄 `src/components/common/ErrorState.tsx` - 错误状态
- 📄 `src/components/common/DetailDrawer.tsx` - 详细信息抽屉
- 📄 `src/components/common/FormModal.tsx` - 表单Modal
- 📄 `src/components/common/ConfirmationModal.tsx` - 确认Modal
- 📄 `src/components/common/DateRangePicker.tsx` - 日期范围选择器
- 📄 `src/components/common/FilterBar.tsx` - 筛选条
- 📄 `src/components/common/Breadcrumb.tsx` - 面包屑
- 📄 `src/components/common/Pagination.tsx` - 分页
- 📄 `src/components/common/Tabs.tsx` - 标签页
- 📄 `src/components/common/SegmentedControl.tsx` - 分段控制

**工作量**：4小时

**小计 PHASE 1A**：11小时

---

### **PHASE 1B：应用外框 & 导航**（第1天下午）

#### 2.1 应用外框 (AppShell)
- 📄 `src/components/layout/AppShell.tsx` - 主布局容器
  - 支持桌面固定侧边栏 (240px)
  - 支持平板可折叠侧边栏
  - 支持手机drawer侧边栏
  - 64px Header
  - 右下角固定Ask AI按钮
  - Toast容器

**工作量**：2小时

#### 2.2 Sidebar导航
- 📄 `src/components/layout/Sidebar.tsx` - 侧边栏
  - 场馆切换器（占位）
  - 导航组：总覽、營運、財務、AI與智慧場館、管理
  - 项目：控制中心、预约管理、活动与教练、会员、球场、定价、营收与财务、发票与费用、报表与分析、AI管理助理、AI智慧球场、设定
  - 响应式折叠

**工作量**：2小时

#### 2.3 Header组件
- 📄 `src/components/layout/Header.tsx` - 顶部栏
  - 日期范围选择器（默认：今天）
  - 通知铃铛（占位）
  - 用户个人资料
  - 移动端菜单按钮
  - 响应式行为

**工作量**：1.5小时

#### 2.4 PageHeader组件
- 📄 `src/components/common/PageHeader.tsx` - 页面头
  - 标题
  - 子标题
  - 操作按钮区
  - 面包屑

**工作量**：1小时

#### 2.5 Ask AI浮窗
- 📄 `src/components/ai/AIWindow.tsx` - AI助理窗口
  - 固定于右下角
  - 收起/展开
  - 对话历史
  - 建议问题
  - Mock回复

**工作量**：2小时

**小计 PHASE 1B**：8.5小时

---

### **PHASE 1C：核心页面 - 仪表板**（第2天上午）

#### 3.1 Dashboard页面
- 📄 `src/app/owner/dashboard/page.tsx`
- 📄 `src/app/owner/dashboard/dashboard-client.tsx`

**功能**：
- SegmentedControl: Today / This Week / This Month
- 6张KPI卡片：
  - 今日营收
  - 预约数
  - 球场使用率
  - 球员数
  - 费用
  - 净利
- 3条趋势线图表（营收、费用、利润）
- 最近预约表格（可点击导向预约管理）
- 球场状态卡片（可点击导向智慧球场）
- AI警示卡片

**响应式**：
- 桌面：12列网格 → 6张KPI卡片 2列、图表 1列、表格全宽
- 平板：2列 KPI + 1列图表 + 全宽表格
- 手机：1列 KPI + 图表可滑动 + 表格为卡片列表

**工作量**：3小时

**小计 PHASE 1C**：3小时

---

### **PHASE 1D：核心页面 - 预约管理**（第2天中午）

#### 4.1 Reservations页面
- 📄 `src/app/owner/reservations/page.tsx`
- 📄 `src/app/owner/reservations/reservations-client.tsx`

**功能**：
- SegmentedControl: Day / Week / Month 切换
- FilterBar：
  - Booking Type (Court/Event/Coach)
  - Status (5种状态)
  - Court选择
  - Date范围
- 预约列表 / 日历视图
- 预约详细Drawer（包含编辑占位）
- 创建预约Modal（占位）

**预约字段**：
- Booking ID
- Member
- Type
- Court/Event/Coach
- Time
- Amount
- Payment Status
- QR Status
- Player Count
- Check-in Status
- Reservation Status

**响应式**：
- 桌面：侧边栏 + 主区域
- 平板：可收合筛选栏
- 手机：日历默认为日视图、表格为卡片

**工作量**：4小时

**小计 PHASE 1D**：4小时

---

### **PHASE 1E：核心页面 - 活动与教练**（第2天下午）

#### 5.1 Events页面
- 📄 `src/app/owner/events/page.tsx`
- 📄 `src/app/owner/events/events-client.tsx`

**功能**：
- 活动列表
- 筛选：类型、状态
- 活动详细Drawer
- 创建活动Modal（占位）

**工作量**：2小时

#### 5.2 Coaches页面
- 📄 `src/app/owner/coaches/page.tsx`
- 📄 `src/app/owner/coaches/coaches-client.tsx`

**功能**：
- 教练列表
- 筛选：状态
- 可预约时段显示
- 教练详细Drawer
- 创建教练Modal（占位）

**工作量**：2小时

**小计 PHASE 1E**：4小时

---

### **PHASE 1F：核心页面 - 财务**（第3天上午）

#### 6.1 Finance Dashboard页面
- 📄 `src/app/owner/finance/page.tsx`
- 📄 `src/app/owner/finance/finance-client.tsx`

**功能**：
- DateRangePicker：Today / Week / Month / Quarter / Year
- 5个财务KPI：
  - Gross Revenue
  - Expenses
  - Net Revenue
  - Operating Profit
  - Profit Margin
- 3条趋势图表
- Revenue Flow表格（可排序/筛选）
- Payment Status摘要
- 按球场统计Revenue
- 按预约类型统计Revenue

**显示**：
- 货币单位（TWD）
- 资料期间
- 计算说明

**工作量**：3小时

#### 6.2 Payments页面
- 📄 `src/app/owner/finance/payments/page.tsx`
- 📄 `src/app/owner/finance/payments/payments-client.tsx`

**功能**：
- 支付状态列表
- 筛选：状态、日期范围
- 支付详细Drawer
- 重试支付占位功能

**工作量**：1.5小时

**小计 PHASE 1F**：4.5小时

---

### **PHASE 1G：财务页面 - 发票、收据、费用**（第3天中午）

#### 7.1 Invoices页面
- 📄 `src/app/owner/invoices/page.tsx`
- 📄 `src/app/owner/invoices/invoices-client.tsx`

**功能**：
- 发票列表
- 筛选：类型、审核状态、日期
- 发票详细Drawer
- 匯出CSV占位功能

**工作量**：2小时

#### 7.2 Receipts页面
- 📄 `src/app/owner/receipts/page.tsx`
- 📄 `src/app/owner/receipts/receipts-client.tsx`

**功能**：
- 收据列表
- OCR流程（模拟）：
  1. 上传图片占位
  2. 显示处理进度（模拟 Uploading → Processing → Complete）
  3. 显示Draft结果
  4. 允许编辑字段
  5. 绝不自动确认为会计分录
- 收据详细Drawer
- 匯出占位功能

**工作量**：3小时

#### 7.3 Expenses页面
- 📄 `src/app/owner/expenses/page.tsx`
- 📄 `src/app/owner/expenses/expenses-client.tsx`

**功能**：
- 费用列表
- 筛选：类别、审核状态、日期
- 费用详细Drawer（显示Draft标记）
- 手动输入占位功能
- 匯出占位功能

**工作量**：2小时

**小计 PHASE 1G**：7小时

---

### **PHASE 1H：AI与智慧球场**（第3天下午）

#### 8.1 AI Assistant页面
- 📄 `src/app/owner/ai-assistant/page.tsx`
- 📄 `src/app/owner/ai-assistant/ai-assistant-client.tsx`

**功能**：
- 全屏AI对话窗口
- 对话历史
- 建议问题列表（业务相关）
- Mock AI回复（显示）：
  - Mock Response
  - Data Period
  - Data Sources
  - Calculation Notes
- 高风险操作：
  - 显示操作预览
  - 要求擁有者确认
  - 绝不执行真实操作
- 清除对话功能
- 匯出对话占位功能

**工作量**：3小时

#### 8.2 Smart Court页面
- 📄 `src/app/owner/smart-court/page.tsx`
- 📄 `src/app/owner/smart-court/smart-court-client.tsx`

**功能**：
- 球场Dashboard（使用之前创建的AI Court Management）
- 至少7个模拟摄像头画面（占位 - 使用灰色框 + 摄像头图标）
- 显示：
  - 球场状态
  - 预约
  - AI偵測人數
  - 燈光/風扇/門禁/攝影機狀態
  - AI 監控狀態
- 未授权使用规则：
  - People Detected > 0 且 无有效预约 → 显示警示
- Snapshot占位功能
- Speaker Warning占位功能
- Owner Notification占位功能
- 设备状态：ONLINE / OFFLINE / WARNING

**工作量**：3小时

**小计 PHASE 1H**：6小时

---

### **PHASE 1I：基础页面**（第4天上午）

#### 9.1 Members页面
- 📄 `src/app/owner/members/page.tsx`
- 📄 `src/app/owner/members/members-client.tsx`

**功能**：
- 会员列表
- 搜索、筛选
- 会员详细Drawer

**工作量**：1.5小时

#### 9.2 Courts页面
- 📄 `src/app/owner/courts/page.tsx`
- 📄 `src/app/owner/courts/courts-client.tsx`

**功能**：
- 球场列表
- 球场状态卡片
- 球场编辑占位

**工作量**：1.5小时

#### 9.3 Pricing页面
- 📄 `src/app/owner/pricing/page.tsx`
- 📄 `src/app/owner/pricing/pricing-client.tsx`

**功能**：
- 定价表格
- 按预约类型分类
- 编辑占位功能

**工作量**：1小时

#### 9.4 Reports页面
- 📄 `src/app/owner/reports/page.tsx`
- 📄 `src/app/owner/reports/reports-client.tsx`

**功能**：
- 报表类型选择
- 日期范围选择
- 生成报表占位功能
- 匯出占位功能

**工作量**：1.5小时

#### 9.5 Settings页面
- 📄 `src/app/owner/settings/page.tsx`
- 📄 `src/app/owner/settings/settings-client.tsx`

**功能**：
- Business Information
- Court Information
- Pricing Information
- Payment Settings
- Operating Rules
- System Mode (显示 SYSTEM_MODE=MOCK)
- API Placeholder Status
- Audit Log Preview
- 编辑占位功能

**工作量**：2小时

**小计 PHASE 1I**：8.5小时

---

### **PHASE 1J：完善与优化**（第4天下午）

#### 10.1 响应式测试与调整
- 桌面布局验证
- 平板布局验证
- 手机布局验证
- 修复溢出问题

**工作量**：2小时

#### 10.2 交互与反馈完善
- Toast通知集成
- 加载状态完善
- 错误处理完善
- 确认Modal流程测试

**工作量**：1.5小时

#### 10.3 无障碍性与SEO
- 语义化HTML检查
- 键盘导航验证
- ARIA标签检查

**工作量**：1小时

#### 10.4 文档与验收
- README更新
- Phase 1验收文件
- Phase 2 API集成规格文档

**工作量**：1.5小时

**小计 PHASE 1J**：6小时

---

## 📊 时间表总览

| 阶段 | 描述 | 时间 | 合计 |
|-----|------|------|-----|
| 1A | 基础架构 & 组件 | 11h | 11h |
| 1B | 应用外框 & 导航 | 8.5h | 19.5h |
| 1C | Dashboard | 3h | 22.5h |
| 1D | 预约管理 | 4h | 26.5h |
| 1E | 活动与教练 | 4h | 30.5h |
| 1F | 财务Dashboard | 4.5h | 35h |
| 1G | 发票、收据、费用 | 7h | 42h |
| 1H | AI与智慧球场 | 6h | 48h |
| 1I | 基础页面 | 8.5h | 56.5h |
| 1J | 完善与优化 | 6h | 62.5h |

**总预计**：62.5小时 ≈ **3.5 - 4天**（按8小时/天工作）

---

## 🎯 关键实现原则

### 数据流
```
UI Components
    ↓
API Service (集中管理)
    ↓
Mock Data Service (SYSTEM_MODE=MOCK)
    ↓
Mock Data Files
```

### 阶段过渡（Phase 2准备）
```
Phase 1:  mockReservationService → Phase 2: reservationService
Phase 1:  mockFinanceService → Phase 2: financeService
Phase 1:  mockAIService → Phase 2: aiService
Phase 1:  mockDeviceService → Phase 2: deviceService
```

### 必须避免
❌ 在组件中直接硬编码数据
❌ 将API密钥暴露到前端
❌ 执行真实设备操作
❌ 自动确认高风险操作
❌ 主要内容在手机上水平溢出

### 必须确保
✅ 所有页面集中式数据模型
✅ 所有页面一致的UI风格
✅ 所有页面支持响应式
✅ 所有操作提供用户反馈
✅ 高风险操作需要确认

---

## 📝 完成检查表

- [ ] 所有16个页面路由能成功加载
- [ ] Sidebar导航能进入每个页面
- [ ] Dashboard显示所有KPI、图表、表格
- [ ] 预约管理支持Day/Week/Month切换和筛选
- [ ] 财务显示所有财务指标和趋势
- [ ] AI助理显示模拟回复和确认流程
- [ ] 智慧球场显示设备状态和7个摄像头占位
- [ ] 所有表单操作显示Toast反馈
- [ ] 桌面、平板、手机皆无水平溢出
- [ ] 高风险操作有确认Modal
- [ ] Settings显示 SYSTEM_MODE=MOCK
- [ ] 所有数据模型集中定义
- [ ] 所有API占位符集中管理
- [ ] 没有硬编码数据在组件中

---

## 🚀 建议开发方式

1. **优先完成PHASE 1A+1B** - 为后续所有页面提供基础
2. **并行开发1C+1D+1E** - 核心业务逻辑页面
3. **依序完成1F+1G** - 财务相关页面
4. **单独完成1H** - AI功能
5. **快速完成1I** - 基础页面
6. **最后1J** - 调整和优化

每完成一个阶段，立即测试响应式和交互。
