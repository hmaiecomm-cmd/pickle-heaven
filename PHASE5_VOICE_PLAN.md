# Phase 5：實時語音對話實現計劃

**狀態：** 規劃階段  
**預期時間：** 2-4 週  
**複雜度：** 高  
**優先度：** 低（可選功能）

## 目標

為 AI 助理添加實時語音對話能力，讓用戶可以：
- 🎤 直接語音提問
- 🔊 聽取 AI 語音回覆
- ⚡ 實時流式音頻（無延遲）
- 📱 支持所有裝置（桌機、平板、手機）

## 技術架構

### 前端技術棧
```
瀏覽器
  ↓
Web Audio API（麥克風輸入）
  ↓
WebSocket（雙向通信）
  ↓
OpenAI Realtime API
  ↓
Web Audio API（喇叭輸出）
```

### 核心組件

#### 1. 語音輸入（Mic → PCM Audio）
```
使用 MediaRecorder API
- 錄製用戶語音
- 轉換為 PCM 16-bit 48kHz
- 實時傳送到 Realtime API
```

#### 2. WebSocket 連接管理
```
建立 ws://realtime.openai.com
- 驗證連接（session token）
- 心跳檢測（Ping/Pong）
- 自動重連機制
- 緩衝管理
```

#### 3. 語音輸出（PCM Audio → Speakers）
```
接收 OpenAI 音頻流
- 解碼 PCM 音頻
- 播放到 AudioContext
- 實時播放（無下載等待）
```

## 實現階段

### Phase 5.1：基礎 WebSocket 連接（1 週）
- [ ] 創建 WebSocket 管理器
- [ ] 實現心跳檢測
- [ ] 錯誤處理和重連
- [ ] 連接狀態管理

**文件：**
- `src/lib/realtime-connection.ts` — WebSocket 管理
- `src/hooks/useRealtimeConnection.ts` — React Hook

### Phase 5.2：音頻輸入（1 週）
- [ ] 麥克風權限請求
- [ ] 音頻錄製（MediaRecorder）
- [ ] PCM 轉換（48kHz, 16-bit）
- [ ] 實時傳送音頻塊

**文件：**
- `src/lib/audio-input.ts` — 麥克風管理
- `src/hooks/useMicrophone.ts` — React Hook

### Phase 5.3：音頻輸出（1 週）
- [ ] PCM 解碼
- [ ] AudioContext 播放
- [ ] 音量控制
- [ ] 播放進度指示

**文件：**
- `src/lib/audio-output.ts` — 喇叭管理
- `src/hooks/useAudioPlayback.ts` — React Hook

### Phase 5.4：UI 組件（1 週）
- [ ] 語音按鈕（按住說話）
- [ ] 實時文字轉錄顯示
- [ ] 音量指示器
- [ ] 連接狀態指示

**文件：**
- `src/components/ai/voice-chat-button.tsx` — 語音控制
- `src/components/ai/voice-waveform.tsx` — 波形顯示

### Phase 5.5：集成和優化（1-2 週）
- [ ] 與現有對話系統集成
- [ ] 性能優化（緩衝管理）
- [ ] 錯誤恢復
- [ ] 語音識別後備方案
- [ ] 測試和調試

## 技術細節

### OpenAI Realtime API

**連接流程：**
```
1. 生成 Session Token（後端）
2. 瀏覽器建立 WebSocket 連接
3. 發送 session.update（配置參數）
4. 開始發送 input_audio_buffer.append（麥克風音頻）
5. 接收 response.audio.delta（AI 語音輸出）
6. 播放音頻 + 顯示文字
```

**消息格式：**
```typescript
// 發送麥克風音頻
{
  type: "input_audio_buffer.append",
  audio: "base64_encoded_pcm_audio"
}

// 接收 AI 語音
{
  type: "response.audio.delta",
  delta: "base64_encoded_pcm_audio",
  index: 0
}

// 文字轉錄
{
  type: "response.text.delta",
  delta: "你好",
  index: 0
}
```

### 音頻格式

```
格式：PCM (Pulse Code Modulation)
採樣率：48000 Hz (48kHz)
深度：16-bit (signed)
通道：Mono (單聲道)
編碼：RAW PCM（無容器）
```

## 安全考慮

✅ **隱私保護**
- 音頻只在瀏覽器內錄製
- 直接發送到 OpenAI（不經過我們的伺服器）
- 用戶可隨時按停止鍵

✅ **權限管理**
- 麥克風權限：瀏覽器原生要求
- WebSocket 連接：需驗證用戶身份

✅ **數據安全**
- WebSocket 使用 WSS（加密）
- Session token 有時間限制
- 自動超時斷線

## 部署和環境

### 環境變數
```env
NEXT_PUBLIC_OPENAI_REALTIME_ENABLED=true
OPENAI_API_KEY=sk-...
```

### 瀏覽器支持
```
✅ Chrome/Edge 90+（MediaRecorder, WebSocket）
✅ Firefox 88+
✅ Safari 14.1+（有限支持）
❌ IE 不支援
```

## 測試計劃

### 單元測試
- WebSocket 連接管理
- 音頻格式轉換
- 緩衝管理

### 集成測試
- 麥克風 → WebSocket → 音頻輸出
- 文字轉錄顯示
- 錯誤恢復

### E2E 測試
- 完整語音對話流程
- 中斷和重連
- 多裝置測試（桌機、平板、手機）

## 已知限制和替代方案

### 瀏覽器支持限制
如果需要 IE 或舊版本支持：
- 後備到文字對話
- 或使用 Whisper API（語音轉文字）

### 低帶寬環境
如果網路速度慢：
- 增加音頻緩衝
- 使用壓縮音頻格式
- 顯示「已錄製」指示

## 成本考慮

**OpenAI Realtime API 定價：**
- 每分鐘音頻輸入：$0.60/分鐘
- 每分鐘音頻輸出：$0.60/分鐘
- 10 分鐘對話 ≈ $0.20

**建議：**
- 新增使用量配額限制
- 顯示成本提示（可選）
- 監控異常使用

## 推出檢查清單

- [ ] 架構設計完成
- [ ] 所有單元測試通過
- [ ] 集成測試成功
- [ ] 性能基準達成（<100ms 延遲）
- [ ] 跨瀏覽器測試完成
- [ ] 安全審計通過
- [ ] 用戶文檔完成
- [ ] A/B 測試計劃
- [ ] 監控和告警設置
- [ ] 推出計劃確認

## 推出後改進

1. **用戶反饋收集**
   - 語音識別準確度
   - 音頻延遲感受
   - 功能易用性

2. **性能優化**
   - 聲學模型優化
   - 音頻緩衝改進
   - 連接穩定性提升

3. **功能擴展**
   - 多語言支持
   - 語音風格選擇
   - 背景雜音消除

## 參考資源

- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket 標準](https://tools.ietf.org/html/rfc6455)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
