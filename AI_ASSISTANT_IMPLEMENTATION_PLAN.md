# OpenAI LLM 對話視窗實施計劃

**項目**: 在顧好 AI 智慧場館平台中集成 OpenAI 對話助理  
**開始日期**: 2026-11-24  
**目標完成**: 分階段實施  
**狀態**: 📋 計劃階段

---

## 實施階段

### 第一階段：文字 AI 視窗 + SSE 串流 ⏳

**目標**: 實現基礎的文字對話功能，支持逐字串流回顯

**任務清單**:
- [ ] 1.1 設置環境變數 (OPENAI_API_KEY, OPENAI_MODEL)
- [ ] 1.2 創建 OpenAI client 配置 (src/lib/openai.ts)
- [ ] 1.3 實施 API Route: /api/ai/chat (後端對話端點)
- [ ] 1.4 實施 SSE 串流（Response Headers + 分段回傳）
- [ ] 1.5 創建前端 AI 視窗組件 (src/components/ai/ai-chat-window.tsx)
- [ ] 1.6 實施權限驗證（登入檢查 + 角色驗證）
- [ ] 1.7 實施輸入驗證（長度 + 內容檢查）
- [ ] 1.8 實施錯誤處理（API 錯誤 + 網路錯誤）
- [ ] 1.9 測試 SSE 串流完整性
- [ ] 1.10 測試 TypeScript 編譯 (npm run typecheck)

**預期文件**:
```
src/lib/openai.ts                              # OpenAI client 配置
src/lib/ai-system-prompts.ts                   # AI 系統提示詞
src/app/api/ai/chat/route.ts                   # SSE 串流端點
src/components/ai/ai-chat-window.tsx           # UI 元件
src/components/ai/ai-chat-bubble.tsx           # 對話泡泡
src/components/ai/ai-chat-input.tsx            # 輸入框
src/__tests__/api/ai-chat.test.ts              # API 測試
```

**預期產出**:
- OpenAI 文字對話可在網站內使用
- 回覆以串流方式逐字顯示
- 支持桌面、平板、手機響應式設計

---

### 第二階段：對話記憶 + 上下文保留

**目標**: 保存對話歷史，支持用戶重新整理後恢復對話

**任務清單**:
- [ ] 2.1 設計對話儲存方案
  - [ ] 2.1a 使用 Conversations API（優先）
  - [ ] 2.1b 或使用 previous_response_id（備選）
- [ ] 2.2 在 Prisma schema 中新增 AIConversation 模型
- [ ] 2.3 實施 conversation 建立和恢復邏輯
- [ ] 2.4 實施 localStorage 保存 conversation ID
- [ ] 2.5 實施頁面重新整理後恢復對話
- [ ] 2.6 實施清除對話功能

**預期文件**:
```
prisma/schema.prisma (修改)                    # 新增 AIConversation
src/lib/ai-conversation-service.ts             # 對話管理服務
src/__tests__/services/ai-conversation.test.ts # 服務測試
```

---

### 第三階段：頁面上下文 + 授權資料查詢

**目標**: AI 能讀取當前頁面資料並根據用戶權限回答

**任務清單**:
- [ ] 3.1 設計上下文傳遞方案
- [ ] 3.2 為支持的頁面提取上下文
  - [ ] 3.2a 場地預約頁面
  - [ ] 3.2b 訂單管理頁面
  - [ ] 3.2c 財務報表頁面
  - [ ] 3.2d 營運狀況報表
  - [ ] 3.2e 門禁管理頁面
- [ ] 3.3 實施後端工具函式
  - [ ] 3.3a getVenueSummary
  - [ ] 3.3b getBookingSummary
  - [ ] 3.3c getOperationalReport
  - [ ] 3.3d getAccessEvents
  - [ ] 3.3e getDeviceStatus
- [ ] 3.4 實施權限檢查（後端再次驗證）
- [ ] 3.5 實施敏感資料過濾

**預期文件**:
```
src/server/ai-context-extractors.ts            # 上下文提取
src/server/ai-tools.ts                         # AI 可用工具
src/server/ai-permissions.ts                   # 權限驗證
```

---

### 第四階段：AI 操作預覽與確認

**目標**: 危險操作需要用戶明確確認

**任務清單**:
- [ ] 4.1 設計操作預覽流程
- [ ] 4.2 實施寫入操作識別
- [ ] 4.3 實施操作預覽顯示
- [ ] 4.4 實施用戶確認機制
- [ ] 4.5 實施安全的操作執行
- [ ] 4.6 實施操作日誌記錄

**支持的安全操作**:
```
- ✅ 查詢資料
- ⚠️ 導出報表
- ✅ 創建場地預約（需確認）
- ✅ 修改場地預約（需確認）
- ✅ 創建門禁授權（需確認）
- ❌ 直接修改密碼
- ❌ 直接遠端開門
- ❌ 直接修改財務資料
- ❌ 直接刪除資料
```

**預期文件**:
```
src/server/ai-operations.ts                    # 操作管理
src/components/ai/ai-operation-preview.tsx     # 預覽元件
```

---

### 第五階段：Realtime 語音功能（可選）

**目標**: 支持用戶直接語音對話

**時間**: 2-4 週後（取決於文字版穩定性）

---

## 文件結構

```
src/
├── lib/
│   ├── openai.ts                        # ✨ OpenAI client 配置
│   ├── ai-system-prompts.ts             # ✨ 系統提示詞
│   └── ai-conversation-service.ts       # ✨ 對話管理服務
├── server/
│   ├── ai-context-extractors.ts         # ✨ 上下文提取
│   ├── ai-tools.ts                      # ✨ AI 工具函式
│   ├── ai-permissions.ts                # ✨ 權限驗證
│   └── ai-operations.ts                 # ✨ 操作管理
├── app/
│   └── api/
│       └── ai/
│           └── chat/
│               └── route.ts              # ✨ SSE 串流端點
├── components/
│   └── ai/
│       ├── ai-chat-window.tsx            # ✨ 主視窗
│       ├── ai-chat-bubble.tsx            # ✨ 對話泡泡
│       ├── ai-chat-input.tsx             # ✨ 輸入框
│       ├── ai-operation-preview.tsx      # ✨ 操作預覽
│       └── styles/
│           └── ai-chat.css               # ✨ 樣式
└── __tests__/
    ├── api/
    │   └── ai-chat.test.ts               # ✨ API 測試
    └── services/
        └── ai-conversation.test.ts       # ✨ 服務測試
```

---

## 環境變數配置

### .env.local (本地開發)

```
OPENAI_API_KEY=sk-...                    # 保密，不要提交
OPENAI_MODEL=gpt-4-turbo                 # 或 gpt-4o
AI_CHAT_MAX_TOKENS=1000                  # 單次回應最大 token 數
AI_INPUT_MAX_LENGTH=2000                 # 用戶輸入最大長度
AI_SYSTEM_PROMPT_VERSION=1               # 系統提示詞版本
```

### .env.example (公開範本)

```
OPENAI_API_KEY=                          # Set your OpenAI API Key
OPENAI_MODEL=gpt-4-turbo
AI_CHAT_MAX_TOKENS=1000
AI_INPUT_MAX_LENGTH=2000
AI_SYSTEM_PROMPT_VERSION=1
```

**重要**: 
- 🚫 不要把真實 API Key 提交到 Git
- 🚫 不要使用 `NEXT_PUBLIC_OPENAI_API_KEY`
- 🔒 只在伺服器端使用 API Key
- 🔒 在 .gitignore 中確保 .env.local 被忽略

---

## 安全檢查清單

### 前端安全
- [ ] API Key 未出現在任何前端代碼
- [ ] API Key 未出現在 console.log
- [ ] API Key 未出現在 browser storage
- [ ] API Key 未出現在 request headers（前端不能直接調用 OpenAI）
- [ ] 敏感資料未傳送給 AI

### 後端安全
- [ ] 登入驗證
- [ ] 角色權限驗證
- [ ] 輸入驗證和淨化
- [ ] 敏感資料過濾
- [ ] 錯誤訊息不洩漏內部細節
- [ ] API 錯誤記錄（不包含 API Key）
- [ ] Request/Response 日誌（隔除敏感資料）

### 權限安全
- [ ] AI 不可查看無權限資料
- [ ] AI 不可繞過現有 Server Action 權限
- [ ] 寫入操作必須確認
- [ ] conversation 必須屬於當前用戶
- [ ] 不同角色隔離

---

## 測試計劃

### 單元測試
- API 端點測試
- 權限驗證測試
- 輸入驗證測試
- SSE 串流測試

### 集成測試
- 端到端對話流程
- 對話恢復流程
- 跨頁面對話連續性

### E2E 測試
- 手機版完整流程
- 平板版完整流程
- 桌面版完整流程
- 權限隔離驗證

### 安全測試
- API Key 未暴露檢查
- 無效輸入処理
- 錯誤訊息檢查
- 權限越界嘗試
- XSS 防護
- CSRF 防護

---

## 驗證指令

### TypeScript 編譯
```bash
npm run typecheck
```

### 生產構建
```bash
npm run build
```

### 測試運行
```bash
npm test
```

### 本地開發
```bash
npm run dev
# 訪問 http://localhost:3000
# 點擊右下角 "詢問小 P" 按鈕開啟 AI 視窗
```

---

## 預期成果

### 第一階段完成後
✅ 用戶可在網站內與 AI 對話  
✅ 回覆流暢地逐字顯示  
✅ 完整的權限檢查  
✅ 明確的錯誤提示

### 第二階段完成後
✅ 對話可跨瀏覽器會話保留  
✅ 重新整理後恢復對話  
✅ 清除對話功能

### 第三階段完成後
✅ AI 能回答頁面相關問題  
✅ AI 能查詢場地、訂單、報表數據  
✅ 完整的權限隔離

### 第四階段完成後
✅ 寫入操作需要確認  
✅ 安全的操作執行  
✅ 完整的操作日誌

### 第五階段完成後（可選）
✅ 支持語音對話  
✅ Realtime 流式音頻

---

## 時間估計

| 階段 | 任務數 | 預期時間 | 狀態 |
|------|--------|---------|------|
| 1 | 10 | 3-5 天 | ⏳ |
| 2 | 6 | 2-3 天 | 待開始 |
| 3 | 8 | 4-5 天 | 待開始 |
| 4 | 6 | 2-3 天 | 待開始 |
| 5 | - | 2-4 週 | 可選 |

**總計**: 約 2-3 週完成前四階段

---

## 風險與緩解

| 風險 | 影響 | 緩解方案 |
|------|------|---------|
| OpenAI API 配額限制 | 無法使用 AI | 監控配額，設置速率限制 |
| SSE 連接中斷 | 對話中斷 | 實施重試機制 |
| 權限驗證錯誤 | 資料洩漏 | 完整的測試覆蓋 |
| Token 超限 | 回應不完整 | 設置 max_tokens 限制 |

---

## 關鍵決策

1. **API 選擇**: OpenAI Responses API (已確定)
2. **串流方案**: Server-Sent Events (已確定)
3. **對話記憶**: Conversations API (優先) 或 previous_response_id (備選)
4. **語音支持**: 第五階段（Realtime API）

---

## 相關文檔

- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/conversation-state)
- [SSE 串流](https://developers.openai.com/api/docs/guides/streaming-responses)
- [API Key 安全](https://developers.openai.com/api/reference/overview)

---

**下一步**: 開始實施第一階段（文字 AI 視窗 + SSE 串流）

