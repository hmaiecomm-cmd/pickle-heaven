# LINE 配置快速检查表

## 📋 第一步：LINE Developers 设置（7 个操作）

### 【第 1-2 步】Provider 和 Channel 创建
- [ ] 登入 LINE Developers (https://developers.line.biz/zh-hant/)
- [ ] 创建 Provider：`匹克天堂`
- [ ] 创建 **LINE Login Channel**
- [ ] 创建 **Messaging API Channel**

### 【第 2 步】LINE Login 凭证收集

| 凭证 | 值 | 来源 |
|------|-----|------|
| **Channel ID** | `_______` | LINE Login → Basic Settings |
| **Channel Secret** | `_______` | LINE Login → Basic Settings → Show |
| **Redirect URL** | ✅ http://localhost:3000 | LINE Login → Redirect URLs |

**检查列表**：
- [ ] Channel ID 已复制并粘贴到上表
- [ ] Channel Secret 已复制并粘贴到上表
- [ ] Redirect URL 已添加

### 【第 3 步】LIFF 应用设置

| 项目 | 值 |
|------|-----|
| **LIFF ID** | `_______` |
| **Endpoint URL** | ✅ http://localhost:3000 |
| **Size** | ✅ Full |
| **Permissions** | ✅ profile, openid, email |

**检查列表**：
- [ ] LIFF 应用已创建
- [ ] LIFF ID 已复制到上表
- [ ] Endpoint URL 已配置为 http://localhost:3000

### 【第 4 步】Messaging API 凭证收集

| 凭证 | 值 | 来源 |
|------|-----|------|
| **Channel Access Token** | `_______` | Messaging API → Channel Access Token |
| **Official Account ID** | `@_______` | Messaging API → Line Official Account |

**检查列表**：
- [ ] Channel Access Token 已复制并粘贴
- [ ] Official Account ID 已记录

---

## 🔧 第二步：环境变量配置

### 打开 `.env.local` 文件

```bash
# Windows (PowerShell)
notepad "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\.env.local"

# Mac (Terminal)
nano ~/.env.local
```

### 填入以下值（使用上面收集的数据）

```env
# ══════════════════ LINE MINI App / LIFF ══════════════════
NEXT_PUBLIC_LIFF_ID="在这里粘贴你的 LIFF ID"
NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID="在这里粘贴你的 Channel ID"
LINE_LOGIN_CHANNEL_ID="在这里粘贴你的 Channel ID"
LINE_LOGIN_CHANNEL_SECRET="在这里粘贴你的 Channel Secret"
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN="在这里粘贴你的 Channel Access Token"
```

### 验证填入

```bash
# 在终端/PowerShell 运行，验证所有值都已填入
cat .env.local | grep LINE_

# 应该看到：
# NEXT_PUBLIC_LIFF_ID=...
# NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID=...
# LINE_LOGIN_CHANNEL_ID=...
# LINE_LOGIN_CHANNEL_SECRET=...
# LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=...
```

**检查列表**：
- [ ] `.env.local` 已打开
- [ ] 所有 5 个 LINE 变量已填入
- [ ] 没有多余的空格或特殊字符
- [ ] 文件已保存

---

## 🧪 第三步：本地测试

### 重启开发服务器

```bash
# 1. 停止当前服务器（按 Ctrl + C）
# 2. 重新启动
npm run dev
```

**检查列表**：
- [ ] 服务器重启成功
- [ ] 没有关于缺少环境变量的错误

### 测试登入页

1. **打开浏览器**访问：
   ```
   http://localhost:3000/login
   ```

2. **检查页面显示**：
   - [ ] 🎾 匹克天堂应用显示
   - [ ] 「請用 LINE 開啟此連結」提示显示
   - [ ] 「複製連結」按钮可点击

3. **打开浏览器控制台** (F12 → Console)：
   - [ ] 看到 `[LIFF] 初始化成功，isInClient: false`
   - [ ] 没有红色错误信息

---

## 📱 第四步：LINE 真实测试

### 准备工作

- [ ] 你的手机上已安装 LINE 应用
- [ ] 已将你的官方账号添加到 LINE 好友列表

### 4.1 获取 LIFF 链接

打开浏览器，访问你的 LIFF 应用：
```
https://liff.line.me/{YOUR_LIFF_ID}/
```

**例子**：
```
https://liff.line.me/2001234567-abcdEFGh/
```

### 4.2 在手机 LINE 中打开链接

1. **复制上面的链接**（或 QR 扫描）
2. **在手机 LINE 中**打开该链接
   - 可以在浏览器中打开链接，然后选择用 LINE 打开
   - 或者在 LINE 的浏览器中直接输入

3. **观察流程**：
   - [ ] 链接在 LINE 内打开
   - [ ] 显示「初始化中...」加载页面
   - [ ] 自动跳转到 LINE Login 页面
   - [ ] 显示权限请求对话框
   - [ ] 同意权限后重定向到预约页面

### 4.3 验证用户信息

在 /booking 页面上应该看到：
- [ ] 你的 LINE 昵称显示
- [ ] 你的 LINE 头像显示
- [ ] 页面内容正常加载

### 4.4 检查数据库

可选：验证用户信息已保存到数据库

```bash
# 打开 Prisma Studio
npm run db:studio
```

在 User 表中应该看到：
- [ ] 一条新用户记录
- [ ] `lineUserId` 已填充
- [ ] `displayName` 是你的 LINE 昵称
- [ ] `pictureUrl` 是你的头像链接

---

## 📊 进度追踪

### LINE Developers 设置
```
[ ] Provider 创建
[ ] LINE Login Channel 创建
[ ] Messaging API Channel 创建
[ ] LIFF 应用创建
[ ] 凭证收集完成
```

**进度**：0/5

### 环境变量配置
```
[ ] .env.local 编辑
[ ] 5 个 LINE 变量填入
[ ] 文件保存
```

**进度**：0/3

### 本地测试
```
[ ] 服务器重启
[ ] 登入页显示正常
[ ] 浏览器控制台无错误
```

**进度**：0/3

### LINE 真实测试
```
[ ] 获取 LIFF 链接
[ ] 在 LINE 中打开
[ ] 完整流程成功
[ ] 用户信息显示
[ ] 数据库验证（可选）
```

**进度**：0/5

---

## 🆘 遇到问题？

### 问题：「LIFF ID 未設定」

**原因**：`.env.local` 未正确填入或服务器未重启

**解决**：
1. 检查 `NEXT_PUBLIC_LIFF_ID` 是否在 `.env.local` 中
2. 确认没有多余空格：`"2001234567-abcdEFGh"` ✅ vs `" 2001234567-abcdEFGh "` ❌
3. 重启服务器：`Ctrl+C` 然后 `npm run dev`

### 问题：LINE 显示「驗證失敗（401）」

**原因**：Channel ID 或 Secret 错误

**解决**：
1. 回到 LINE Developers
2. 重新复制 Channel ID（**完整的数字**）
3. 重新复制 Channel Secret（**显示完整字符串**）
4. 确保没有多余空格或符号
5. 更新 `.env.local`
6. 重启服务器

### 问题：用户信息未显示或数据库无记录

**原因**：数据库连接或认证端点错误

**解决**：
1. 检查浏览器控制台的错误
2. 检查服务器日志是否显示错误
3. 确认 `SESSION_SECRET` 已正确设置
4. 查看 `/api/auth/line/verify` 是否返回 200

### 问题：推播消息无法发送

**原因**：Messaging API Token 不对或用户未加入官方账号

**解决**：
1. 重新复制 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
2. 确保用户已加入你的官方账号 (`@pickleheaven`)
3. 在 LINE Developers 后台的 Messaging API 标签下测试推播

---

## ✅ 最终检查

所有步骤完成后，确认以下项目：

### 配置检查
- [ ] `.env.local` 有 5 个 LINE 变量，无空值
- [ ] 所有值都从 LINE Developers 直接复制，无修改
- [ ] 服务器已重启

### 功能检查
- [ ] 本地：http://localhost:3000/login 正常显示
- [ ] 本地：浏览器控制台无 LIFF 相关错误
- [ ] 真实：LIFF 链接在 LINE 中可打开
- [ ] 真实：完整登入流程成功（登入 → 授权 → 重定向）
- [ ] 数据库：用户信息已保存

---

## 📞 需要帮助？

如果遇到任何问题，请提供：

1. **错误信息** — 完整的错误文本或截图
2. **日志输出** — 浏览器控制台和服务器终端的日志
3. **你采取的步骤** — 详细说明你做了什么
4. **环境信息** — `.env.local` 中的 LINE 变量（隐藏敏感部分）

示例：
```
❌ 问题：LIFF 显示「初始化失敗」
📋 错误信息：[LIFF 错误] Channel ID 不存在
🔧 我做的：
  1. 创建了 LIFF 应用
  2. 在 .env.local 填入了 LIFF ID
  3. 重启了服务器
🖥️ 环境：
  NEXT_PUBLIC_LIFF_ID="200123****"
  NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID="1234****"
```

祝你配置顺利！🚀
