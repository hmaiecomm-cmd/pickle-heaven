# 登入流程测试指南

## ✅ 服务器启动

```
npm run dev
```

服务器运行在 `http://localhost:3000`

---

## 🧪 测试场景

### 场景 1️⃣：**未登入用户访问首页**

**URL**: `http://localhost:3000`

**预期行为**:
- [ ] 页面显示「載入中...」加载动画
- [ ] 2-3 秒后自动重定向到 `/login`
- [ ] 登入页面显示「匹克天堂」和「請用 LINE 開啟此連結」提示

**调试（如果卡住）**:
- 检查浏览器控制台是否有错误
- 查看网络标签（Network）中的请求是否成功
- 检查 `.env.local` 中的 `SESSION_SECRET` 是否至少 16 字符

---

### 场景 2️⃣：**在桌机浏览器中访问登入页**

**URL**: `http://localhost:3000/login`

**预期行为**:
- [ ] 显示「匹克天堂」应用品牌
- [ ] 显示「🎾」图标
- [ ] 显示复制链接按钮
- [ ] 显示「請用 LINE 開啟此連結」的提示
- [ ] 显示四个步骤指示（在 LINE 中打开、点击官方账号、选择预约、享受体验）

**测试复制链接按钮**:
- [ ] 点击「📋 複製連結」按钮
- [ ] 应该弹出「連結已複製！」提示

**样式检查**:
- [ ] 页面有绿色渐变背景
- [ ] 卡片有阴影效果
- [ ] 文字清晰易读
- [ ] 在手机宽度下仍然能正常显示

---

### 场景 3️⃣：**模拟 LINE 登入（开发模式）**

如果你还没有设置真实的 LINE 环境变量，可以使用开发登入模式：

**设置开发登入**:

编辑 `.env.local`：
```env
NEXT_PUBLIC_DEV_LOGIN="1"
DEV_LOGIN="1"
```

然后重启服务器：
```bash
npm run dev
```

**访问开发登入页面**:

```
http://localhost:3000/auth/dev-login
```

（这个页面会让你选择一个测试用户进行登入）

**预期行为**:
- [ ] 显示开发登入页面
- [ ] 选择一个测试用户
- [ ] 成功登入后自动重定向到 `/booking`

---

### 场景 4️⃣：**真实 LINE 登入流程**

**前置条件**:
- [ ] 你已在 LINE Developers 后台创建了 LIFF 应用
- [ ] 已填入 `.env.local` 中的以下值：
  ```env
  NEXT_PUBLIC_LIFF_ID="你的-LIFF-ID"
  NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID="你的-CHANNEL-ID"
  LINE_LOGIN_CHANNEL_SECRET="你的-SECRET"
  ```

**测试步骤**:

1. **在手机上用 LINE 打开你的应用链接**
   ```
   https://liff.line.me/{LIFF_ID}/
   ```

2. **观察预期行为**:
   - [ ] LIFF 加载动画出现
   - [ ] 自动进行 LINE 登入
   - [ ] 成功登入后显示加载页面
   - [ ] 1-2 秒后自动进入 `/booking` 页面

3. **验证用户信息**:
   - [ ] 检查浏览器 DevTools → Application → Cookies
   - [ ] 应该看到 `ph_session` Cookie
   - [ ] Cookie 应该标记为 `HttpOnly` 和 `Secure`（在生产环境）

4. **验证数据库**:
   - [ ] 运行 `npm run db:studio` 打开 Prisma Studio
   - [ ] 检查 `User` 表是否有新用户记录
   - [ ] 验证 `lineUserId`、`displayName` 等字段已正确填充

---

## 🐛 常见问题和调试

### ❌ 问题 1：页面显示「初始化失敗」

**可能原因**:
- SESSION_SECRET 没有设置或太短
- 数据库连接失败
- 环境变量加载错误

**调试步骤**:
```bash
# 1. 检查环境变量
cat .env.local | grep SESSION_SECRET

# 2. 检查 SESSION_SECRET 长度（需要 ≥ 16 字符）
# 3. 查看浏览器控制台错误信息
# 4. 检查服务器日志
```

### ❌ 问题 2：LIFF 初始化失败

**错误信息**: `NEXT_PUBLIC_LIFF_ID 未設定`

**解决方案**:
```env
# 确保 .env.local 中有以下行
NEXT_PUBLIC_LIFF_ID="2001234567-abcdEFGh"  # 替换为你的 LIFF ID
```

### ❌ 问题 3：LINE ID Token 验证失败

**错误信息**: `LINE id_token 驗證失敗（401）`

**可能原因**:
- `LINE_LOGIN_CHANNEL_ID` 或 `LINE_LOGIN_CHANNEL_SECRET` 错误
- TOKEN 已过期
- Channel 权限配置不正确

**调试**:
```bash
# 查看服务器日志中的 [line] 标签输出
# 验证 LINE Developers 后台的 Channel 设置
```

### ❌ 问题 4：Session Cookie 未设置

**现象**: 登入后仍重定向到登入页

**调试步骤**:
1. 打开浏览器 DevTools
2. Application → Cookies
3. 查看是否有 `ph_session` Cookie
4. 如果没有，检查服务器日志中的错误

**可能原因**:
- JWT 签名密钥（SESSION_SECRET）有问题
- 数据库操作失败
- Cookie 设置被浏览器阻止（检查隐私设置）

### ❌ 问题 5：页面空白或崩溃

**调试**:
```bash
# 检查浏览器控制台是否有 JavaScript 错误
# 检查服务器日志
tail -f <服务器输出>

# 尝试硬刷新浏览器
# Ctrl + Shift + R (Windows)
# Cmd + Shift + R (Mac)
```

---

## 🔍 检查清单

在认为登入流程完全工作前，请验证以下所有项目：

### 环境配置
- [ ] `.env.local` 文件存在
- [ ] `SESSION_SECRET` 已设置且长度 ≥ 16 字符
- [ ] 如有 LINE 环境变量，已正确填入

### 代码文件
- [ ] `src/hooks/useLiff.ts` 存在
- [ ] `src/app/api/auth/line/verify/route.ts` 存在
- [ ] `src/app/api/auth/line/logout/route.ts` 存在
- [ ] `src/app/login/page.tsx` 存在
- [ ] `src/app/page.tsx` 已更新为客户端组件

### 功能测试
- [ ] 未登入用户访问 `/` 重定向到 `/login`
- [ ] 登入页在桌机上显示正确提示
- [ ] 登入页在手机上正常显示
- [ ] 复制链接按钮可工作
- [ ] 成功登入后重定向到 `/booking`
- [ ] 用户信息正确保存到数据库

### 数据验证
- [ ] 登入后 `ph_session` Cookie 存在
- [ ] Cookie 被标记为 `HttpOnly`
- [ ] 用户记录在 `User` 表中创建
- [ ] `lineUserId` 字段已正确填充

---

## 📊 监控登入流程

### 浏览器控制台检查

打开 DevTools → Console，查看以下日志：

```javascript
// 预期看到的日志序列
[LIFF] 初始化成功，isInClient: true
[LIFF] 取得 ID Token，驗證中...
[auth/line/verify] 開始驗證 ID Token
[auth/line/verify] LINE ID Token 驗證成功: U1234...
[auth/line/verify] 新用戶，建立記錄: U1234...
[auth/line/verify] 建立 JWT Session
[auth/line/verify] Session 建立完成
[login] 用戶已登入，重導到 /booking
```

### 网络标签检查

DevTools → Network，查看以下请求：

1. **POST /api/auth/line/verify**
   - 状态：200
   - 响应包含用户信息（lineUserId、displayName）

2. **重定向请求**
   - 自动跳转到 `/booking`

### 服务器日志检查

终端输出应该包含：

```
[auth/line/verify] 開始驗證 ID Token
[auth/line/verify] LINE ID Token 驗證成功
[auth/line/verify] 建立 JWT Session
[auth/line/verify] Session 建立完成
```

---

## 🎯 下一步

测试完成后：

1. **问题已解决** ✅
   - 继续到任务 2（测试）或任务 3（服务条款）

2. **遇到问题** ❌
   - 记录错误信息和日志
   - 告诉 Claude，提供截图或日志

3. **需要微调**
   - UI 样式调整
   - 错误提示改进
   - 其他功能增强

---

## 📞 获取帮助

如果遇到问题，请提供：

1. **错误信息** — 完整的错误文本
2. **日志输出** — 浏览器控制台和服务器日志
3. **环境配置** — 相关的 `.env.local` 设置（隐藏敏感信息）
4. **截图** — 如果有 UI 问题
5. **步骤重现** — 你采取的具体步骤

祝测试顺利！🚀
