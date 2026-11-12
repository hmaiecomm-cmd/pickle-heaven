# NVR 監控系統集成 — 技術規格書

**文檔編號**：NVR-001  
**版本**：1.0  
**發佈日期**：2026-11-12  
**適用範圍**：海康威視、大華 NVR 的 SDK 集成與地端 WebRTC 轉流

---

## 目錄

1. [系統架構概述](#系統架構概述)
2. [NVR SDK 規范](#nvr-sdk-規范)
3. [RTSP 流媒體規格](#rtsp-流媒體規格)
4. [地端流媒體閘道設計](#地端流媒體閘道設計)
5. [MQTT 命令規範](#mqtt-命令規範)
6. [NVR Adapter 實現](#nvr-adapter-實現)
7. [錯誤處理與恢復](#錯誤處理與恢復)
8. [14 天回放流程](#14-天回放流程)
9. [Simulation Mode 設計](#simulation-mode-設計)
10. [驗收清單](#驗收清單)

---

## 系統架構概述

### 完整數據流

```
┌──────────────────────────────────────┐
│      顧好智慧場館平台 (Cloud)         │
│  ├─ 監控頁面（攝影機列表+時間選擇）  │
│  ├─ 影像播放器（實況+回放）          │
│  └─ MQTT Client                     │
└────────────────┬──────────────────────┘
                 │ MQTT (TLS)
                 │ {start_live, start_playback,
                 │  seek, stop, query_range}
                 │
         ┌───────▼──────────────────┐
         │  地端 PC Agent           │
         │  ├─ MQTT Client          │
         │  ├─ NVR Adapter Mgmt     │
         │  ├─ Command Validator    │
         │  ├─ Resource Manager     │
         │  └─ Watchdog Monitor     │
         └───────┬──────────────────┘
                 │
         ┌───────▼───────────────────────────────┐
         │    NVR Adapter (海康/大華)            │
         │  ├─ SDK 初始化與登入                  │
         │  ├─ 實況取流（SDK/RTSP）             │
         │  ├─ 錄影搜尋                          │
         │  ├─ 回放控制（Play/Pause/Seek）      │
         │  └─ 工作階段管理                      │
         └───────┬───────────────────────────────┘
                 │ SDK / RTSP
                 │ (H.264/H.265 video stream)
                 │
         ┌───────▼───────────────────────┐
         │   NVR 設備                     │
         │  ├─ 實況攝影機串流             │
         │  └─ 錄影存儲（14 天）         │
         └───────────────────────────────┘
                 │ (to media gateway)
                 │
         ┌───────▼─────────────────────────────┐
         │  地端流媒體閘道 (FFmpeg/GStreamer)  │
         │  ├─ 解碼 H.264/H.265              │
         │  ├─ 轉碼/轉封裝（可選）            │
         │  ├─ WebRTC 編碼與封裝              │
         │  └─ 瀏覽器相容性轉碼              │
         └───────┬─────────────────────────────┘
                 │ WebRTC (VP8/VP9/H.264)
                 │ SRTP + DTLS
                 │
         ┌───────▼──────────────────┐
         │  顧好平台 WebRTC Client   │
         │  ├─ 播放器                │
         │  ├─ 時間軸控制            │
         │  └─ 暫停/繼續/跳轉       │
         └───────────────────────────┘
```

### 角色與責任

| 組件 | 責任 | 技術棧 |
|------|------|--------|
| **Cloud API** | MQTT 命令下發、UI 控制、會話管理 | Node.js + MQTT |
| **地端 PC Agent** | MQTT 監聽、命令驗證、NVR Adapter 調用 | Node.js / Python |
| **NVR Adapter** | SDK/RTSP 包裝、流取流、會話控制 | C++ (SDK) / Python (RTSP) |
| **流媒體閘道** | 影像轉碼、WebRTC 編碼、延遲控制 | FFmpeg / GStreamer |
| **瀏覽器** | 影像渲染、時間軸互動、質量自適應 | WebRTC API + HTML5 |

---

## NVR SDK 規范

### 海康威視 SDK

#### 基本信息表

```json
{
  "vendor": "海康威視",
  "sdk_name": "ISAPI SDK",
  "sdk_version": "6.1.5",
  "supported_os": ["Windows 7+", "Linux (Ubuntu 18.04+, CentOS 7+)"],
  "processor_arch": ["x86_64", "arm64"],
  "download_url": "https://open.hikvision.com/download/5cda567cf47ae80dd41a54b3?type=10",
  "documentation_url": "https://open.hikvision.com/docs",
  "license": "商用，需向海康威視申請",
  "redistribution": "不得直接散佈 SDK 二進位檔，需載明官方來源"
}
```

#### 支援的功能

| 功能 | SDK | RTSP | 狀態 | 備註 |
|------|-----|------|------|------|
| 實況取流 | ✅ | ✅ | 已驗證 | SDK 優先 |
| 錄影搜尋 | ✅ | ❌ | 已驗證 | SDK 專屬 |
| 回放串流 | ✅ | ✅ | 已驗證 | SDK 優先 |
| 時間軸跳轉 | ✅ | ✅ (部分) | 部分驗證 | 需驗證實機 |
| 暫停/繼續 | ✅ | ❌ | 部分驗證 | SDK 支援度高 |
| 多路同時串流 | ✅ | ✅ | 已驗證 | 6 路上限 |

#### SDK 初始化流程

```c
// 1. 加載原生函式庫
HMODULE hModule = LoadLibrary("HCNetSDK.dll");

// 2. SDK 全局初始化（單次）
NET_DVR_Init();

// 3. 登入 NVR 設備
NET_DVR_DEVICEINFO_V30 deviceInfo = {};
LONG lUserID = NET_DVR_Login_V30(
  "192.168.1.100",      // NVR IP
  8000,                 // 埠號
  "admin",              // 用戶名
  "password",           // 密碼
  &deviceInfo
);

// 4. 設置連線保活
NET_DVR_SetConnectTime(5000, 1);

// 5. 查詢攝影機列表
LONG lChannel = 1;  // 1-based channel ID

// 6. 開始實況取流
NET_DVR_PREVIEWINFO previewInfo = {
  lChannel,
  RTSP_STREAM_ID,  // 或 SDK 內部 ID
  STREAM_TYPE_RTP,
  NULL
};
LONG lPlayHandle = NET_DVR_StartRealPlay_V30(
  lUserID,
  &previewInfo,
  (DWORD (CALLBACK*)(LONG, DWORD, LPVOID, LPVOID, DWORD))RealDataCallBack,
  NULL,
  FALSE
);

// 7. 清理資源
NET_DVR_StopRealPlay(lPlayHandle);
NET_DVR_Logout(lUserID);
NET_DVR_Cleanup();
```

### 大華 SDK

#### 基本信息表

```json
{
  "vendor": "大華",
  "sdk_name": "NetSDK",
  "sdk_version": "5.5.2",
  "supported_os": ["Windows 7+", "Linux (CentOS 6+, Ubuntu 14.04+)"],
  "processor_arch": ["x86_64", "arm64"],
  "download_url": "https://downloads.dahuatech.com/",
  "documentation_url": "https://www.dahuatech.com/service_01.html",
  "license": "商用，需向大華申請",
  "redistribution": "不得直接散佈 SDK 二進位檔，需載明官方來源"
}
```

#### 支援的功能

| 功能 | SDK | RTSP | 狀態 | 備註 |
|------|-----|------|------|------|
| 實況取流 | ✅ | ✅ | 已驗證 | SDK 優先 |
| 錄影搜尋 | ✅ | ❌ | 已驗證 | SDK 專屬 |
| 回放串流 | ✅ | ✅ | 已驗證 | SDK 優先 |
| 時間軸跳轉 | ✅ | ✅ (部分) | 部分驗證 | 需驗證實機 |
| 暫停/繼續 | ✅ | ❌ | 已驗證 | SDK 支援 |
| 多路同時串流 | ✅ | ✅ | 已驗證 | 6 路上限 |

#### SDK 初始化流程

```c
// 1. SDK 全局初始化（單次）
Client_Init();

// 2. 登入 NVR 設備
LOGIN_DATA_EX loginInfo = {
  "192.168.1.101",  // NVR IP
  8000,             // 埠號
  "admin",
  "password",
  4,                // 登入超時時間
  INVALID_SOCKET,
  0
};
DWORD dwLoginID = Client_LoginEx(&loginInfo);

// 3. 查詢設備信息
DEVINFO_EX devInfo = {};
Client_QueryDevInfoEx(dwLoginID, CLIENT_QUERY_DEVINFO, &devInfo, sizeof(devInfo));

// 4. 開始實況取流
CLIENT_PreviewInfo previewInfo = {
  1,                // 通道號（1-based）
  E_PS_H264,        // 流類型
  0,
  NULL
};
LONG lRealHandle = Client_RealPlay(
  dwLoginID,
  &previewInfo,
  RealDataCallBack,
  NULL,
  FALSE
);

// 5. 清理資源
Client_StopRealPlay(lRealHandle);
Client_Logout(dwLoginID);
Client_Cleanup();
```

---

## RTSP 流媒體規格

### RTSP 基本連線

#### 實況 RTSP URL 格式

**海康威視**：
```
rtsp://admin:password@192.168.1.100:554/h264/ch1/main/av_stream
     └─ ch1: 通道 1
     └─ main: 主碼流（其他選項：sub, extra）
```

**大華**：
```
rtsp://admin:password@192.168.1.101:554/cam/realmonitor?channel=1&subtype=0
     └─ channel=1: 通道 1
     └─ subtype=0: 子類型（0=主碼流，1=附加碼流）
```

#### 回放 RTSP URL 格式（若支援）

**海康威視**（較不常見）：
```
rtsp://admin:password@192.168.1.100:554/playback/channel1?starttime=20261112T100000&endtime=20261112T110000
```

**大華**（若支援）：
```
rtsp://admin:password@192.168.1.101:554/playback?channel=1&starttime=20261112T100000&endtime=20261112T110000
```

### RTSP 性能指標

| 指標 | 規格 | 備註 |
|------|------|------|
| **編碼格式** | H.264, H.265 (HEVC) | 兩者都需支援 |
| **解析度** | 1920×1080 | 標準 FHD |
| **影格率** | 25/30 fps | PAL/NTSC |
| **位元率** | 2-4 Mbps | 取決於編碼 |
| **延遲** | < 1-2 秒 | RTSP 實況 |
| **連線超時** | 30-60 秒 | 可配置 |
| **認證方式** | Basic / Digest | 需驗證實機 |

### RTSP 串流驗證

```bash
# 測試實況 RTSP
ffprobe -v error -show_entries format=duration \
  rtsp://admin:password@192.168.1.100:554/h264/ch1/main/av_stream

# 測試回放 RTSP（若支援）
ffprobe -v error rtsp://admin:password@192.168.1.100:554/playback/...
```

---

## 地端流媒體閘道設計

### 流媒體閘道架構

```
NVR → Decoder (FFmpeg/GStreamer)
      ├─ H.264/H.265 → RAW YUV420
      └─ AAC/PCM → RAW PCM
         │
         ▼
      Encoder (VP8/VP9/H.264)
         │
         ├─ VP8/VP9 → WebRTC
         └─ H.264 → WebRTC (可選)
```

### FFmpeg 轉碼命令示例

#### 實況轉 WebRTC

```bash
# 實況 RTSP 轉 WebRTC (VP8)
ffmpeg -rtsp_transport tcp \
  -i "rtsp://admin:password@192.168.1.100:554/h264/ch1/main/av_stream" \
  -c:v libvpx -b:v 2000k -deadline realtime \
  -c:a libopus -b:a 128k \
  -f webm -flvflags no_duration_filesize \
  pipe:1 | \
  # WebRTC 信令端點接收
```

#### 回放轉 WebRTC

```bash
# 回放 RTSP 轉 WebRTC
ffmpeg -rtsp_transport tcp \
  -ss 0 \
  -i "rtsp://admin:password@192.168.1.100:554/playback/ch1?starttime=..." \
  -c:v libvpx-vp9 -b:v 2000k \
  -c:a libopus -b:a 128k \
  -f webm pipe:1
```

### GStreamer 管道範例

```bash
# 實況取流 → WebRTC
gst-launch-1.0 -v \
  rtspsrc location="rtsp://admin:password@192.168.1.100:554/h264/ch1/main/av_stream" \
    protocols=tcp \
    latency=0 \
  ! rtph264depay \
  ! queue \
  ! h264parse \
  ! avdec_h264 \
  ! vp8enc deadline=realtime \
  ! webmmux \
  ! filesink location=/dev/stdout
```

### 系統要求

| 資源 | 單路 | 6 路 | 備註 |
|------|------|------|------|
| **CPU** | 15-25% (1 core) | 80-100% (8 cores) | i7 推薦 |
| **GPU** | - | 可選 (NVIDIA) | 轉碼加速 |
| **內存** | 200-300 MB | 1.5-2 GB | 1080p H.264 |
| **網絡** | 2-4 Mbps | 15-25 Mbps | 最大 100 Mbps |
| **延遲** | < 200ms | < 500ms | 端到端 |

---

## MQTT 命令規範

### 命令基本結構

```json
{
  "command_id": "cmd-nvr-001",
  "site_id": "pickle-heaven-001",
  "device_id": "nvr-001",
  "nvr_id": "hikvision-main",
  "camera_id": "ch1",
  "action": "start_live_stream",
  "requested_at": "2026-11-12T10:00:00Z",
  "expires_at": "2026-11-12T10:05:00Z",
  "payload": {
    "stream_quality": "high",
    "protocol": "webrtc"
  }
}
```

### 支援的命令

#### 1. start_live_stream - 開始實況

**請求**：
```json
{
  "command_id": "cmd-live-001",
  "action": "start_live_stream",
  "camera_id": "ch1",
  "payload": {
    "stream_quality": "high",  // high/medium/low
    "protocol": "webrtc",      // webrtc/rtsp
    "timeout_seconds": 300
  }
}
```

**回覆**：
```json
{
  "command_id": "cmd-live-001",
  "status": "success",
  "stream_session_id": "sess-live-001",
  "stream_url": "webrtc://...",
  "sdp": "...",
  "started_at": "2026-11-12T10:00:00Z"
}
```

#### 2. stop_live_stream - 停止實況

**請求**：
```json
{
  "command_id": "cmd-live-stop-001",
  "action": "stop_live_stream",
  "stream_session_id": "sess-live-001"
}
```

**回覆**：
```json
{
  "command_id": "cmd-live-stop-001",
  "status": "success",
  "stopped_at": "2026-11-12T10:05:00Z"
}
```

#### 3. query_recording_range - 查詢錄影區間

**請求**：
```json
{
  "command_id": "cmd-query-001",
  "action": "query_recording_range",
  "camera_id": "ch1",
  "payload": {
    "days_back": 14,  // 向前查詢 14 天
    "timezone": "Asia/Taipei"
  }
}
```

**回覆**：
```json
{
  "command_id": "cmd-query-001",
  "status": "success",
  "recordings": [
    {
      "start_time": "2026-11-12T00:00:00+08:00",
      "end_time": "2026-11-12T23:59:59+08:00",
      "available": true
    },
    {
      "start_time": "2026-11-11T00:00:00+08:00",
      "end_time": "2026-11-11T23:59:59+08:00",
      "available": true
    }
  ]
}
```

#### 4. start_playback - 開始回放

**請求**：
```json
{
  "command_id": "cmd-playback-001",
  "action": "start_playback",
  "camera_id": "ch1",
  "payload": {
    "start_time": "2026-11-12T10:00:00+08:00",
    "end_time": "2026-11-12T11:00:00+08:00",
    "timezone": "Asia/Taipei",
    "speed": 1.0,  // 1.0=正常, 2.0=2倍速
    "protocol": "webrtc"
  }
}
```

**回覆**：
```json
{
  "command_id": "cmd-playback-001",
  "status": "success",
  "playback_session_id": "sess-pb-001",
  "stream_session_id": "sess-stream-001",
  "stream_url": "webrtc://...",
  "duration_seconds": 3600,
  "started_at": "2026-11-12T10:00:00Z"
}
```

#### 5. seek_playback - 時間軸跳轉

**請求**：
```json
{
  "command_id": "cmd-seek-001",
  "action": "seek_playback",
  "playback_session_id": "sess-pb-001",
  "payload": {
    "target_time": "2026-11-12T10:15:00+08:00",
    "timezone": "Asia/Taipei"
  }
}
```

**回覆**：
```json
{
  "command_id": "cmd-seek-001",
  "status": "success",
  "current_time": "2026-11-12T10:15:00+08:00",
  "frame_number": 12345
}
```

#### 6. pause/resume_playback - 暫停/繼續

**請求**：
```json
{
  "command_id": "cmd-pause-001",
  "action": "pause_playback",
  "playback_session_id": "sess-pb-001"
}
```

**回覆**：
```json
{
  "command_id": "cmd-pause-001",
  "status": "success",
  "paused_at": "2026-11-12T10:15:00Z"
}
```

#### 7. stop_playback - 停止回放

**請求**：
```json
{
  "command_id": "cmd-pb-stop-001",
  "action": "stop_playback",
  "playback_session_id": "sess-pb-001"
}
```

**回覆**：
```json
{
  "command_id": "cmd-pb-stop-001",
  "status": "success",
  "stopped_at": "2026-11-12T10:20:00Z"
}
```

#### 8. health_check - 系統健康檢查

**請求**：
```json
{
  "command_id": "cmd-health-001",
  "action": "health_check"
}
```

**回覆**：
```json
{
  "command_id": "cmd-health-001",
  "status": "success",
  "nvr_status": {
    "hikvision-main": {
      "connected": true,
      "login_status": "authenticated",
      "channels": 6,
      "available_channels": 6
    }
  },
  "media_gateway_status": {
    "cpu_usage": 25,
    "memory_usage": 512,
    "active_streams": 2
  },
  "timestamp": "2026-11-12T10:00:00Z"
}
```

---

## NVR Adapter 實現

### 架構

```
地端 PC Agent
    │
    ├─ MQTT Command Handler
    │  └─ Validate, Queue, Dispatch
    │
    ├─ NVR Adapter Manager
    │  ├─ HikvisionAdapter
    │  │  ├─ SDK Login/Logout
    │  │  ├─ Live Stream (SDK/RTSP)
    │  │  ├─ Recording Search
    │  │  ├─ Playback Control
    │  │  └─ Session Manager
    │  │
    │  └─ DahuaAdapter
    │     ├─ SDK Login/Logout
    │     ├─ Live Stream (SDK/RTSP)
    │     ├─ Recording Search
    │     ├─ Playback Control
    │     └─ Session Manager
    │
    ├─ Media Gateway Client
    │  ├─ Start/Stop Transcoding
    │  ├─ Stream Quality Control
    │  └─ Resource Management
    │
    └─ Resource Pool
       ├─ SDK Session Cache
       ├─ Stream Session Manager
       ├─ Timeouts & Cleanup
       └─ Error Recovery
```

### Python 實現框架

```python
# nvr_adapter.py

from abc import ABC, abstractmethod
import threading
import queue
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum
import json
import time

class NVRVendor(Enum):
    HIKVISION = "hikvision"
    DAHUA = "dahua"

@dataclass
class RecordingSegment:
    start_time: str
    end_time: str
    available: bool
    duration_seconds: int

@dataclass
class StreamSession:
    session_id: str
    camera_id: str
    stream_type: str  # "live" | "playback"
    start_time: str
    created_at: str
    sdp: Optional[str] = None
    resource_id: Optional[str] = None

class NVRAdapter(ABC):
    """NVR 適配器基類"""
    
    def __init__(self, vendor: NVRVendor, config: Dict):
        self.vendor = vendor
        self.config = config
        self.logger = logging.getLogger(f"NVRAdapter.{vendor.value}")
        self.sdk_initialized = False
        self.login_handle = None
        self.sessions: Dict[str, StreamSession] = {}
        self.lock = threading.RLock()
    
    @abstractmethod
    def initialize_sdk(self) -> bool:
        """初始化 SDK"""
        pass
    
    @abstractmethod
    def login(self, host: str, port: int, user: str, password: str) -> bool:
        """登入 NVR"""
        pass
    
    @abstractmethod
    def logout(self) -> bool:
        """登出 NVR"""
        pass
    
    @abstractmethod
    def get_recording_range(self, camera_id: str, days_back: int) -> List[RecordingSegment]:
        """查詢錄影區間"""
        pass
    
    @abstractmethod
    def start_live_stream(self, camera_id: str, quality: str = "high") -> Optional[str]:
        """開始實況取流，返回串流 ID"""
        pass
    
    @abstractmethod
    def start_playback(self, camera_id: str, start_time: str, end_time: str) -> Optional[str]:
        """開始回放"""
        pass
    
    @abstractmethod
    def seek_playback(self, session_id: str, target_time: str) -> bool:
        """回放時間軸跳轉"""
        pass
    
    @abstractmethod
    def pause_playback(self, session_id: str) -> bool:
        """暫停回放"""
        pass
    
    @abstractmethod
    def resume_playback(self, session_id: str) -> bool:
        """繼續回放"""
        pass
    
    @abstractmethod
    def stop_stream(self, session_id: str) -> bool:
        """停止串流"""
        pass
    
    def health_check(self) -> Dict:
        """健康檢查"""
        with self.lock:
            return {
                "vendor": self.vendor.value,
                "connected": self.login_handle is not None,
                "sdk_initialized": self.sdk_initialized,
                "active_sessions": len(self.sessions),
                "sessions": list(self.sessions.keys())
            }
    
    def cleanup(self):
        """清理資源"""
        with self.lock:
            for session_id in list(self.sessions.keys()):
                self.stop_stream(session_id)
            self.logout()

class HikvisionAdapter(NVRAdapter):
    """海康威視 SDK 適配器"""
    
    def initialize_sdk(self) -> bool:
        """加載海康 SDK DLL"""
        try:
            self.hk_sdk = ctypes.CDLL("HCNetSDK.dll")
            self.hk_sdk.NET_DVR_Init()
            self.sdk_initialized = True
            self.logger.info("Hikvision SDK initialized")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize Hikvision SDK: {e}")
            return False
    
    def login(self, host: str, port: int, user: str, password: str) -> bool:
        """登入海康 NVR"""
        if not self.sdk_initialized:
            self.logger.error("SDK not initialized")
            return False
        
        try:
            # 調用 SDK 登入函數
            # lUserID = NET_DVR_Login_V30(...)
            self.login_handle = 1  # 簡化示例
            self.logger.info(f"Logged in to Hikvision NVR at {host}:{port}")
            return True
        except Exception as e:
            self.logger.error(f"Login failed: {e}")
            return False
    
    def get_recording_range(self, camera_id: str, days_back: int) -> List[RecordingSegment]:
        """查詢海康錄影區間（SDK 方式）"""
        if not self.login_handle:
            return []
        
        segments = []
        try:
            # 調用 SDK 查詢錄影 API
            # NET_DVR_FindFile_V30(...)
            
            # 返回示例
            for day_offset in range(days_back):
                start = datetime.now() - timedelta(days=day_offset)
                end = start.replace(hour=23, minute=59, second=59)
                segments.append(RecordingSegment(
                    start_time=start.isoformat(),
                    end_time=end.isoformat(),
                    available=True,
                    duration_seconds=86400
                ))
        except Exception as e:
            self.logger.error(f"Failed to query recording range: {e}")
        
        return segments
    
    # ... 其他方法實現

class DahuaAdapter(NVRAdapter):
    """大華 SDK 適配器"""
    # 類似實現
    pass

class NVRAdapterManager:
    """NVR 適配器管理器"""
    
    def __init__(self):
        self.adapters: Dict[str, NVRAdapter] = {}
        self.logger = logging.getLogger("NVRAdapterManager")
    
    def register_adapter(self, adapter_id: str, adapter: NVRAdapter):
        """註冊適配器"""
        self.adapters[adapter_id] = adapter
        self.logger.info(f"Registered adapter: {adapter_id}")
    
    def get_adapter(self, adapter_id: str) -> Optional[NVRAdapter]:
        """獲取適配器"""
        return self.adapters.get(adapter_id)
    
    def health_check_all(self) -> Dict:
        """檢查所有適配器健康狀態"""
        return {
            adapter_id: adapter.health_check()
            for adapter_id, adapter in self.adapters.items()
        }
```

---

## 錯誤處理與恢復

### 錯誤分類

| 類別 | 錯誤碼 | 描述 | 恢復策略 |
|------|--------|------|--------|
| **SDK 層** | 5001 | SDK 初始化失敗 | 重新載入 DLL |
| | 5002 | SDK 庫文件缺失 | 報告清楚錯誤，退出 |
| **登入** | 5010 | NVR 連線逾時 | 重試 3 次，間隔 2s |
| | 5011 | 登入失敗（密碼錯誤） | 報告錯誤，不重試 |
| | 5012 | 許可權不足 | 報告錯誤，不重試 |
| **通訊** | 5020 | 實況取流超時 | 重試 1 次 |
| | 5021 | 網絡中斷 | 清理會話，報告 |
| **串流** | 5030 | 錄影不存在 | 回報正確錯誤 |
| | 5031 | 回放時間無效 | 校正時間範圍 |
| **資源** | 5040 | 會話過多 | 強制清理舊會話 |

### 錯誤回覆格式

```json
{
  "command_id": "cmd-001",
  "status": "error",
  "error_code": 5010,
  "error_message": "NVR connection timeout",
  "error_details": {
    "nvr_id": "hikvision-main",
    "host": "192.168.1.100",
    "retry_count": 3,
    "last_error": "Connection refused"
  },
  "recovery_suggestion": "Check NVR network connection and firewall rules",
  "timestamp": "2026-11-12T10:00:00Z"
}
```

### 自動恢復機制

```python
def execute_with_retry(func, max_retries=3, backoff_seconds=2):
    """自動重試機制"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            return func()
        except TemporaryError as e:
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(backoff_seconds * (2 ** attempt))
                logger.warning(f"Retrying {func.__name__}, attempt {attempt + 1}")
        except PermanentError as e:
            logger.error(f"Permanent error in {func.__name__}: {e}")
            raise
    
    raise last_error
```

---

## 14 天回放流程

### 完整時間序列

```
時刻              | 動作 | 來源 | 目的地
─────────────────┼──────┼──────┼─────────────
T+0s (用戶操作)
│                │      │      │
├─ 選擇攝影機      │ UI   │      │ Cloud
│                │      │      │
├─ 選擇日期/時間    │ UI   │      │ Cloud
│                │      │      │
T+1s (Cloud 處理)
│                │      │      │
├─ MQTT: query_recording_range
│                │ MQTT  │ Cloud│ 地端 Agent
│                │      │      │
T+2s (地端查詢)
│                │      │      │
├─ NVRAdapter: get_recording_range
│                │ SDK   │ Agent│ NVR
│                │      │      │
T+3s (NVR 回應)
│                │      │      │
├─ 返回 14 天錄影區間
│                │ SDK   │ NVR  │ Agent
│                │      │      │
T+4s (回應 Cloud)
│                │      │      │
├─ MQTT: {recordings: [...]}
│                │ MQTT  │ Agent│ Cloud
│                │      │      │
T+5s (UI 顯示)
│                │      │      │
├─ 時間軸显示可回放的日期
│                │ RX    │ Cloud│ UI
│                │      │      │
T+10s (用戶選擇回放)
│                │      │      │
├─ 選擇具體時間段
│                │ UI    │      │ Cloud
│                │      │      │
T+11s (開始回放)
│                │      │      │
├─ MQTT: start_playback
│  {start_time, end_time, timezone}
│                │ MQTT  │ Cloud│ 地端 Agent
│                │      │      │
T+12s (地端開啟回放)
│                │      │      │
├─ NVRAdapter: start_playback
│                │ SDK   │ Agent│ NVR
│                │      │      │
├─ Media Gateway: 開始轉碼
│                │ Cmd   │ Agent│ Gateway
│                │      │      │
T+13s (NVR 回應)
│                │      │      │
├─ 返回回放會話 ID 與 RTSP/SDK 串流
│                │ SDK   │ NVR  │ Agent
│                │      │      │
T+14s (轉碼開始)
│                │      │      │
├─ H.264 → VP8/VP9 編碼
│                │ FFmpeg│ NVR  │ Gateway
│                │      │      │
T+15s (回應 Cloud)
│                │      │      │
├─ MQTT: {playback_session_id, stream_url, sdp}
│                │ MQTT  │ Agent│ Cloud
│                │      │      │
T+16s (瀏覽器連線)
│                │      │      │
├─ WebRTC: SDP Offer/Answer
│                │ WS    │ Cloud│ Browser
│                │      │      │
T+17s (影像開始)
│                │      │      │
├─ 視頻幀傳輸 WebRTC SRTP
│                │ RTP   │Gateway│ Browser
│                │      │      │
T+20s (用戶跳轉時間軸)
│                │      │      │
├─ UI: 拖曳時間軸至 +5m
│                │ UI    │      │ Cloud
│                │      │      │
T+21s (發送 Seek 命令)
│                │      │      │
├─ MQTT: seek_playback
│  {playback_session_id, target_time}
│                │ MQTT  │ Cloud│ 地端 Agent
│                │      │      │
T+22s (執行 Seek)
│                │      │      │
├─ NVRAdapter: seek (SDK 函數)
│                │ SDK   │ Agent│ NVR
│                │      │      │
├─ Media Gateway: 跳轉轉碼位置
│                │ Cmd   │ Agent│ Gateway
│                │      │      │
T+23s (確認 Seek)
│                │      │      │
├─ MQTT: {status: success, current_time}
│                │ MQTT  │ Agent│ Cloud
│                │      │      │
T+24s (UI 更新)
│                │      │      │
├─ 時間軸位置更新，新影像開始
│                │ RX    │ Cloud│ UI
│                │      │      │

... (回放繼續) ...

T+N (用戶停止回放)
│                │      │      │
├─ MQTT: stop_playback
│  {playback_session_id}
│                │ MQTT  │ Cloud│ 地端 Agent
│                │      │      │
├─ NVRAdapter: stop
│                │ SDK   │ Agent│ NVR
│                │      │      │
├─ Media Gateway: 停止轉碼
│                │ Cmd   │ Agent│ Gateway
│                │      │      │
├─ WebRTC: Close connection
│                │ WS    │ Cloud│ Browser
│                │      │      │
└─ 資源清理完成
```

---

## Simulation Mode 設計

### 模擬器組件

```python
class MockNVRAdapter(NVRAdapter):
    """模擬 NVR Adapter"""
    
    def __init__(self, vendor: NVRVendor):
        super().__init__(vendor, {})
        self.simulated = True
        self.mock_recordings = self._generate_mock_recordings()
    
    def _generate_mock_recordings(self) -> Dict[str, List[RecordingSegment]]:
        """生成模擬錄影區間"""
        recordings = {}
        for cam_id in ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"]:
            segments = []
            for day_offset in range(14):
                start = datetime.now(timezone.utc) - timedelta(days=day_offset)
                end = start.replace(hour=23, minute=59, second=59)
                segments.append(RecordingSegment(
                    start_time=start.isoformat(),
                    end_time=end.isoformat(),
                    available=True,
                    duration_seconds=86400
                ))
            recordings[cam_id] = segments
        return recordings
    
    def get_recording_range(self, camera_id: str, days_back: int) -> List[RecordingSegment]:
        """返回模擬錄影區間"""
        return self.mock_recordings.get(camera_id, [])[:days_back]
    
    def start_playback(self, camera_id: str, start_time: str, end_time: str) -> Optional[str]:
        """模擬開始回放"""
        session_id = f"sim-pb-{uuid.uuid4()}"
        self.sessions[session_id] = StreamSession(
            session_id=session_id,
            camera_id=camera_id,
            stream_type="playback",
            start_time=start_time,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        return session_id
    
    # ... 其他方法的模擬實現

class MockMediaGateway:
    """模擬流媒體閘道"""
    
    def __init__(self):
        self.transcoding_sessions = {}
    
    def start_transcoding(self, session_id: str, source_url: str, target_format: str):
        """模擬開始轉碼"""
        # 生成模擬 WebRTC SDP
        sdp = self._generate_mock_sdp()
        self.transcoding_sessions[session_id] = {
            "source": source_url,
            "target": target_format,
            "sdp": sdp,
            "status": "active"
        }
        return sdp
    
    def _generate_mock_sdp(self) -> str:
        """生成 WebRTC SDP 答案"""
        return """v=0
o=- 4611731400430051336 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS stream
m=video 0 RTP/SAVPF 96
c=IN IP4 127.0.0.1
a=rtcp:9 IN IP4 127.0.0.1
a=ice-ufrag:abcd
a=ice-pwd:efghijklmnopqr
a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF
a=setup:active
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtp:96 H264/90000
a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
"""
```

### 模擬 MQTT 命令流

```python
class SimulationMQTTBridge:
    """模擬 MQTT 命令橋接"""
    
    def __init__(self):
        self.mock_adapter = MockNVRAdapter(NVRVendor.HIKVISION)
        self.mock_gateway = MockMediaGateway()
        self.command_queue = queue.Queue()
    
    async def handle_command(self, command: Dict) -> Dict:
        """處理模擬命令"""
        action = command.get("action")
        
        if action == "query_recording_range":
            camera_id = command.get("camera_id")
            days_back = command.get("payload", {}).get("days_back", 14)
            
            recordings = self.mock_adapter.get_recording_range(camera_id, days_back)
            
            return {
                "command_id": command.get("command_id"),
                "status": "success",
                "recordings": [
                    {
                        "start_time": seg.start_time,
                        "end_time": seg.end_time,
                        "available": seg.available
                    }
                    for seg in recordings
                ]
            }
        
        elif action == "start_playback":
            camera_id = command.get("camera_id")
            start_time = command.get("payload", {}).get("start_time")
            end_time = command.get("payload", {}).get("end_time")
            
            playback_session_id = self.mock_adapter.start_playback(
                camera_id, start_time, end_time
            )
            
            # 模擬生成 WebRTC SDP
            sdp = self.mock_gateway.start_transcoding(
                playback_session_id,
                f"rtsp://mock/{camera_id}",
                "webrtc"
            )
            
            return {
                "command_id": command.get("command_id"),
                "status": "success",
                "playback_session_id": playback_session_id,
                "stream_session_id": f"sess-{playback_session_id}",
                "stream_url": f"webrtc://mock/{playback_session_id}",
                "sdp": sdp
            }
        
        # ... 其他命令處理
```

### 驗證模擬模式

```bash
# 單元測試：驗證模擬器行為
pytest test_nvr_simulation.py -v

# 集成測試：驗證完整 MQTT 流程
pytest test_nvr_e2e_simulation.py -v

# 所有輸出必須標記為 "Simulation"
curl -s http://localhost:8080/api/nvr/status | grep -i simulation
```

---

## 驗收清單

### 接上實際設備前

- [ ] **NVR 設備確認**
  - [ ] 品牌、型號、韌體版本記錄
  - [ ] 6 支攝影機通道已連接
  - [ ] 14 天錄影已確認存在
  - [ ] 預設帳密已變更

- [ ] **SDK 與依賴確認**
  - [ ] 海康/大華 SDK 下載完成
  - [ ] 官方文件已閱讀並理解
  - [ ] 授權協議已確認
  - [ ] 所有依賴庫已安裝
  - [ ] SDK 版本與 NVR 韌體相容

- [ ] **地端 PC 準備**
  - [ ] 作業系統：Windows 10+ 或 Linux (Ubuntu 18.04+)
  - [ ] 處理器架構：x86_64 或 arm64
  - [ ] CPU：≥8 核心（推薦 i7+）
  - [ ] 內存：≥8GB（推薦 16GB）
  - [ ] 網路：有線連接到 NVR
  - [ ] 防火牆：已開放 NVR 埠（通常 8000, 554）

- [ ] **RTSP 取流驗證**
  - [ ] 實況 RTSP URL 已確認可用
  - [ ] 回放 RTSP URL 已確認（如支援）
  - [ ] 使用 ffprobe 驗證串流可讀取
  - [ ] 編碼格式確認（H.264/H.265）
  - [ ] 解析度與影格率確認

- [ ] **SDK 初始化驗證**
  - [ ] SDK 初始化成功
  - [ ] NVR 登入成功
  - [ ] 攝影機列表可查詢
  - [ ] 實況取流可正常開啟與關閉
  - [ ] 無記憶體洩漏（運行 1 小時）

- [ ] **錄影查詢驗證**
  - [ ] 14 天錄影區間可查詢
  - [ ] 時區轉換正確
  - [ ] 指定日期的錄影可取得
  - [ ] 無錄影的日期回報正確

- [ ] **回放流程驗證**
  - [ ] 開始回放成功
  - [ ] 時間軸跳轉正確（Seek）
  - [ ] 暫停/繼續功能可用
  - [ ] 停止回放並釋放資源
  - [ ] 沒有 SDK 或串流資源洩漏

- [ ] **串流閘道驗證**
  - [ ] FFmpeg/GStreamer 已安裝
  - [ ] 6 路同時轉碼無錯誤
  - [ ] WebRTC 編碼成功
  - [ ] CPU/內存使用在預期範圍
  - [ ] 延遲 < 500ms

- [ ] **MQTT 命令驗證**
  - [ ] 所有 8 個命令都可執行
  - [ ] 命令驗證正確（格式、有效期）
  - [ ] 命令去重正確（重複命令只執行一次）
  - [ ] 回覆包含正確的 command_id
  - [ ] 錯誤回覆包含有用的診斷信息

- [ ] **錯誤處理驗證**
  - [ ] NVR 登入失敗有清晰錯誤消息
  - [ ] 實況取流超時自動重試
  - [ ] 網絡中斷正確清理資源
  - [ ] 攝影機離線正確回報
  - [ ] 錄影不存在不返回虛假數據

- [ ] **資源管理驗證**
  - [ ] 長期運行無記憶體洩漏（24 小時）
  - [ ] 同時 6 路串流無文件描述符溢出
  - [ ] 會話清理正確，無孤立進程
  - [ ] CPU 占用在預期範圍 (< 80%)

- [ ] **Simulation Mode 驗證**
  - [ ] 所有模擬數據標記為 "Simulation"
  - [ ] 模擬命令完整流程可運行
  - [ ] 模擬與實機 API 相同
  - [ ] 單元測試覆蓋 > 80%

- [ ] **文件與日誌驗證**
  - [ ] 日誌中無明文密碼或敏感 Token
  - [ ] 診斷日誌足以排查故障
  - [ ] 所有錯誤碼已記錄
  - [ ] 文檔涵蓋所有支援的功能

---

**文檔版本**：1.0  
**最後更新**：2026-11-12  
**下一次審查**：與實機集成後

