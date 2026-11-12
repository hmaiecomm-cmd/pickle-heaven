# LINE Developers 完整配置指南

本指南将详细教你如何在 LINE Developers 后台配置，获取所需的密钥，并进行真实登入测试。

---

## 📋 目录

1. [前置要求](#前置要求)
2. [第一步：创建 Provider 和 Channel](#第一步创建-provider-和-channel)
3. [第二步：获取 LINE Login Channel 凭证](#第二步获取-line-login-channel-凭证)
4. [第三步：创建和配置 LIFF](#第三步创建和配置-liff)
5. [第四步：获取 Messaging API Channel 凭证](#第四步获取-messaging-api-channel-凭证)
6. [第五步：配置环境变量](#第五步配置环境变量)
7. [第六步：本地测试](#第六步本地测试)
8. [第七步：在 LINE 上测试](#第七步在-line-上测试)
9. [常见问题](#常见问题)

---

## 前置要求

在开始之前，请确保你有：

- ✅ LINE 账户（如果没有，请先注册 https://account.line.biz/zh-Hant/）
- ✅ LINE Developers 账户（https://developers.line.biz/zh-hant/）
- ✅ 一个 LINE 官方账号（用于测试）
- ✅ 一台装有 LINE 的手机（用于测试真实流程）
- ✅ 本地开发服务器运行中（`npm run dev`）

---

## 第一步：创建 Provider 和 Channel

### 1.1 登入 LINE Developers

1. **打开**：https://developers.line.biz/zh-hant/
2. **点击右上角**「ログイン」（登入）
3. **使用 LINE 账户登入**

### 1.2 创建 Provider（提供者）

1. **进入左侧菜单** → 「Providers」
2. **点击**「Create」或「新規作成」按钮
3. **输入 Provider 名称**：
   ```
   匹克天堂 / Pickle Heaven
   ```
4. **点击**「Create」确认

> **Provider 是什么？** 
> 它是你的应用的顶级组织单位。你可以在一个 Provider 下创建多个 Channel（LINE Login、Messaging API 等）。

### 1.3 查看 Provider 详情

创建完成后，你应该看到：
- **Provider Name**：匹克天堂
- **Provider ID**：一串数字（记下来，后续会用到）

---

## 第二步：获取 LINE Login Channel 凭证

LINE Login Channel 用于用户身份验证。

### 2.1 创建 LINE Login Channel

1. **在 Providers 页面**，找到你刚创建的 Provider
2. **点击该 Provider 名称**进入详情页
3. **点击**「Create Channel」或「チャネルを新規作成」
4. **选择 Channel Type**：
   ```
   LINE Login
   ```
5. **填写表单**：

   | 字段 | 值 |
   |------|-----|
   | Channel name（频道名称） | `pickle-heaven-login` |
   | Channel description（频道描述） | `匹克天堂 - LINE Login` |
   | App type（应用类型） | 选择「Web」|
   | App icon（应用图标） | 上传你的应用图标（可选） |
   | Privacy policy URL（隐私政策） | 留空或填写你的网址 |
   | Terms of Service URL（服务条款） | 留空或填写你的网址 |

6. **点击**「Create」

### 2.2 获取 LINE Login 凭证

创建完成后，进入 Channel 详情页：

#### **① Channel ID**

1. **找到**「Basic Settings」或「基本設定」标签
2. **查找**「Channel ID」字段
3. **复制这个数字**，例如：
   ```
   1234567890
   ```

#### **② Channel Secret**

1. **在同一个页面**下滑找到「Channel Secret」
2. **点击**「Show」或「表示」显示密钥
3. **复制整个字符串**，例如：
   ```
   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

> ⚠️ **重要**：不要分享 Channel Secret！

#### **③ 配置 OAuth redirect URL**

1. **在「LINE Login」标签下**
2. **找到**「Redirect URLs」或「認可 URL」
3. **点击**「Add」或「追加」
4. **输入你的回调 URL**：
   ```
   http://localhost:3000/api/auth/line/callback
   ```
   （本地开发）或
   ```
   https://your-domain.com/api/auth/line/callback
   ```
   （生产环境）

5. **点击**「Add」保存

---

## 第三步：创建和配置 LIFF

LIFF（Line Front-end Framework）让你的应用可以在 LINE 内部运行。

### 3.1 导航到 LIFF 管理页面

1. **回到 Providers 页面**
2. **找到你的 Provider**，点击进入
3. **点击**「LINE Login」Channel
4. **找到左侧菜单的**「LIFF」标签
5. **点击**「Create」或「新規作成」

### 3.2 创建 LIFF 应用

**填写以下信息**：

| 字段 | 值 | 说明 |
|------|-----|------|
| **LIFF app name** | `pickle-heaven-mini-app` | 应用名称 |
| **Size** | `Full` | LIFF 窗口大小（Full = 全屏） |
| **Endpoint URL** | `http://localhost:3000` | 你的应用地址 |
| **Permissions** | `profile` `openid` `email` | 请求的权限（用户信息） |
| **Modules** | 勾选 `LINE Messaging API` | 可选，允许应用使用 Messaging API |

### 3.3 获取 LIFF ID

创建完成后：

1. **在 LIFF 列表中**找到你刚创建的应用
2. **点击该应用**进入详情
3. **复制** `LIFF ID`，格式如：
   ```
   2001234567-abcdEFGh
   ```

> 💡 **LIFF ID 是什么？**
> 这是在 LINE 内打开你的应用的唯一标识。用户可以通过以下 URL 访问：
> ```
> https://liff.line.me/{LIFF_ID}/
> ```

---

## 第四步：获取 Messaging API Channel 凭证

Messaging API 用于向用户发送推播消息（订单通知等）。

### 4.1 创建 Messaging API Channel

1. **回到 Providers 页面**
2. **找到你的 Provider**
3. **点击**「Create Channel」
4. **选择 Channel Type**：
   ```
   Messaging API
   ```

5. **填写表单**：

   | 字段 | 值 |
   |------|-----|
   | Channel name | `pickle-heaven-messaging` |
   | Channel description | `匹克天堂 - 订单推播` |
   | Category（分类） | 选择合适的分类 |
   | Subcategory（子分类） | 选择合适的子分类 |
   | Email address | 你的邮箱 |

6. **同意条款** ✅
7. **点击**「Create」

### 4.2 获取 Channel Access Token

1. **进入 Messaging API Channel**
2. **点击**「Messaging API」标签
3. **找到** `Channel access token` 部分
4. **点击**「Issue」或「發行」
5. **复制生成的长字符串**，例如：
   ```
   abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ...
   ```

> ⚠️ **重要**：
> - 这个 Token 用于发送推播消息
> - 不要分享给其他人
> - 如果泄露，请立即在 LINE Developers 后台重新生成

### 4.3 获取 Channel ID（Messaging API）

1. **在同一个页面**找到「Channel ID」
2. **复制这个数字**

> 注意：这个 Channel ID 与 LINE Login 的 Channel ID 不同！

---

## 第五步：配置环境变量

现在你已经获取了所有凭证，编辑 `.env.local` 文件。

### 5.1 打开 `.env.local`

```bash
# Windows
notepad "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\.env.local"

# Mac/Linux
nano /path/to/.env.local
```

### 5.2 填入凭证

找到以下行，用你从 LINE Developers 获取的值替换：

```env
# ══════════════════ LINE MINI App / LIFF ══════════════════
NEXT_PUBLIC_LIFF_ID="2001234567-abcdEFGh"                # 替换为你的 LIFF ID
NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID="1234567890"           # 替换为 LINE Login Channel ID
LINE_LOGIN_CHANNEL_ID="1234567890"                       # 同上
LINE_LOGIN_CHANNEL_SECRET="a1b2c3d4e5f6g7h8i9j0..."     # 替换为 Channel Secret
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN="abcdefg..."         # 替换为 Messaging API Token
```

### 5.3 保存文件

保存并关闭。

### 5.4 验证配置

```bash
# 检查是否有错误
cat .env.local | grep LINE_
```

你应该看到所有的 LINE 变量都已填入。

---

## 第六步：本地测试

### 6.1 重启开发服务器

```bash
# 停止当前服务器（Ctrl + C）
# 然后重启
npm run dev
```

### 6.2 测试桌机版本

打开浏览器访问：
```
http://localhost:3000/login
```

**预期看到**：
- [ ] 匹克天堂登入页
- [ ] 「請用 LINE 開啟此連結」提示
- [ ] 複製連結功能可用

### 6.3 检查浏览器控制台

F12 → Console，应该看到：
```
[LIFF] 初始化成功，isInClient: false
```

如果看到错误，检查环境变量是否正确填入。

---

## 第七步：在 LINE 上测试

### 7.1 在手机上打开 LINE

### 7.2 添加官方账号

1. **在 LINE Developers 后台**找到你的 Messaging API Channel
2. **复制 LINE 官方账号 ID**，格式如 `@pickleheaven`
3. **在手机 LINE 上**搜索这个账号
4. **点击**「加為好友」或「Add as friend」

### 7.3 获取 LIFF 链接

访问：
```
https://liff.line.me/{YOUR_LIFF_ID}/
```

**替换 `{YOUR_LIFF_ID}` 为你的 LIFF ID**，例如：
```
https://liff.line.me/2001234567-abcdEFGh/
```

### 7.4 在 LINE 中打开链接

1. **在手机上**，从你的计算机/笔记本发送这个链接（用 LINE、Email 或其他方式）
2. **点击链接**在 LINE 中打开
3. **观察流程**

### 7.5 预期流程

```
手机 LINE 打开链接
    ↓
[LIFF] 初始化
    ↓
检测用户未登入 → 自动重导至 LINE Login
    ↓
用户同意授权（显示 LINE 权限对话框）
    ↓
获取 ID Token
    ↓
POST /api/auth/line/verify
    ↓
后端验证成功
    ↓
建立 JWT Session
    ↓
重定向到 /booking（预约页面）
```

### 7.6 验证成功登入

**预期看到**：
- [ ] 自动重导到预约页面
- [ ] 页面显示已登入状态
- [ ] 可以看到你的 LINE 昵称和头像

---

## 常见问题

### ❌ 问题 1：LIFF 显示「初始化失败」

**原因**：LIFF ID 错误或不存在

**解决**：
1. 再次确认 LIFF ID 是否正确
2. 检查 `.env.local` 中的 `NEXT_PUBLIC_LIFF_ID` 是否正确
3. 确保 LIFF 应用的状态是「On」（已启用）

### ❌ 问题 2：LINE Login 跳转后返回错误页面

**原因**：Channel ID 或 Secret 错误

**解决**：
1. 在 LINE Developers 后台重新复制 Channel ID 和 Secret
2. 检查是否有额外的空格
3. 检查 `.env.local` 是否正确填入

### ❌ 问题 3：消息「驗證失敗（401）」

**原因**：ID Token 验证失败（可能是 Channel ID/Secret 错误）

**调试**：
```javascript
// 在浏览器控制台运行
console.log('Channel ID:', process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID)
console.log('LIFF ID:', process.env.NEXT_PUBLIC_LIFF_ID)
```

检查这些值是否正确。

### ❌ 问题 4：用户未被添加到数据库

**原因**：数据库连接失败或 Prisma 问题

**解决**：
1. 检查 `TURSO_DATABASE_URL` 是否正确
2. 运行 `npm run db:turso:init` 重新初始化
3. 检查服务器日志中的错误

### ❌ 问题 5：推播消息无法发送

**原因**：Messaging API Token 不对或用户未加入官方账号

**解决**：
1. 确认 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 正确
2. 确保用户已加入你的官方账号
3. 在 LINE Developers 后台的「Message API」标签下测试推播

---

## ✅ 完成检查清单

在认为 LINE 配置完成前，请确认以下所有项目：

### LINE Developers 配置
- [ ] 已创建 Provider
- [ ] 已创建 LINE Login Channel，获取 Channel ID 和 Secret
- [ ] 已创建 LIFF 应用，获取 LIFF ID
- [ ] 已配置 LIFF 的 Endpoint URL（http://localhost:3000）
- [ ] 已创建 Messaging API Channel，获取 Access Token

### 环境变量
- [ ] `.env.local` 已更新
- [ ] `NEXT_PUBLIC_LIFF_ID` 已填入
- [ ] `NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID` 已填入
- [ ] `LINE_LOGIN_CHANNEL_SECRET` 已填入
- [ ] `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 已填入

### 本地测试
- [ ] 开发服务器正在运行
- [ ] `http://localhost:3000/login` 可正常访问
- [ ] 浏览器控制台无错误

### LINE 真实测试
- [ ] 已将官方账号加入 LINE 好友
- [ ] 已获取 LIFF 链接
- [ ] 在手机 LINE 中打开链接后自动重导到 LINE Login
- [ ] 同意权限后自动重定向到预约页
- [ ] 用户信息正确显示

---

## 🎯 下一步

登入流程完整测试成功后：

1. **任务 2** — 编写单元和集成测试
2. **任务 3** — 实现服务条款和用户同意
3. **部署** — 部署到生产环境（Vercel）

祝配置顺利！🚀
