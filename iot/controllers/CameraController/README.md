# 攝影機控制器 (Camera Controller)

## 📚 文檔索引

### 實現規格
- **NVR_INTEGRATION_TECHNICAL_SPECIFICATION.md**
  - NVR SDK（海康/大華）完整規格
  - RTSP 流媒體格式
  - MQTT 命令規範（8 個核心命令）
  - Modbus RTU 協議（如適用）
  - WebRTC 轉碼設計
  - 14 天回放流程
  - Simulation Mode 設計
  - 驗收檢查清單（15+ 項）

### 實現計劃
- **NVR_INTEGRATION_IMPLEMENTATION_PLAN.md**
  - 8-10 週分階段計劃
  - W1-W2: 框架設計
  - W3-W4: SDK 集成
  - W5-W6: 實況/回放控制
  - W7: 流媒體閘道
  - W8: Simulation Mode
  - W9-W10: 實機集成與驗收
  - 里程碑與交付物
  - 代碼統計（8,850 行）
  - 測試用例（205+）

## 🎯 關鍵功能

- ✅ 實況取流（Live Stream）
- ✅ 錄影回放（Playback）
- ✅ 時間軸跳轉（Seek）
- ✅ 暫停/繼續（Pause/Resume）
- ✅ 14 天歷史回放
- ✅ 6 路同時轉碼
- ✅ WebRTC 視頻傳輸
- ✅ MQTT 命令控制

## 📊 系統要求

| 組件 | 要求 |
|------|------|
| **NVR 設備** | 海康威視或大華（6 通道） |
| **地端 PC** | Intel i7 8核 + 8GB RAM + 100Mbps 網絡 |
| **SDK** | 海康 v6.1.5+ 或 大華 v5.5.2+ |
| **轉碼引擎** | FFmpeg/GStreamer |
| **延遲** | < 500ms (端到端) |

## 🔧 MQTT 命令

```json
{
  "start_live_stream": "開始實況",
  "stop_live_stream": "停止實況",
  "query_recording_range": "查詢 14 天錄影",
  "start_playback": "開始回放",
  "seek_playback": "跳轉時間軸",
  "pause_playback": "暫停回放",
  "resume_playback": "繼續回放",
  "stop_playback": "停止回放"
}
```

## 📈 進度追蹤

- ⏳ W1-W2: 框架設計 (預計 2-3 週)
- ⏳ W3-W4: SDK 集成 (預計 2-3 週)
- ⏳ W5-W6: 功能完成 (預計 2-3 週)
- ⏳ W7: 流媒體閘道 (預計 1 週)
- ⏳ W8: Simulation 測試 (預計 1 週)
- ⏳ W9-W10: 實機驗收 (預計 2 週)

**預期上線**：2026-12-31

## 🔗 相關文檔位置

- 📄 [技術規格書](./NVR_INTEGRATION_TECHNICAL_SPECIFICATION.md)
- 📄 [實現計劃](./NVR_INTEGRATION_IMPLEMENTATION_PLAN.md)
- 📁 [根目錄文檔](../../)

---

**最後更新**：2026-11-12  
**維護人**：Claude Haiku 4.5
