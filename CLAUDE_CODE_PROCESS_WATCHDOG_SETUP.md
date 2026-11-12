# Claude Code 進程監控和自動保活

## 🎯 功能概述

**Process Watchdog** 確保 Claude Code 進程始終保持運行：

| 功能 | 詳情 |
|------|------|
| ✅ **自動監控** | 每 10 秒檢查一次 Claude Code 進程 |
| ✅ **自動重啟** | 進程崩潰或意外關閉時自動重啟 |
| ✅ **開機自啟** | 系統啟動時自動啟動監控 |
| ✅ **智能保護** | 短時間內多次崩潰時停止重啟，防止無限迴圈 |
| ✅ **詳細日誌** | 所有操作記錄到日誌文件 |
| ✅ **告警系統** | 進程異常時生成告警 |

---

## 📋 系統架構

```
Windows 系統
    ↓
[任務計劃程序]
    ↓
[PowerShell 監控腳本]
(claude-code-watchdog.ps1)
    ↓
┌─────────────────────────────────────────┐
│ 1. 檢查 Claude Code 進程                  │
│ 2. 如果進程不存在 → 重啟                  │
│ 3. 如果進程崩潰 → 重啟                   │
│ 4. 記錄所有操作到日誌                    │
└─────────────────────────────────────────┘
    ↓
[Claude Code]
(持續運行，即使發生崩潰)
```

---

## 🚀 快速設置（3 步）

### 第 1 步：以管理員身份打開 PowerShell

```bash
# Windows 11：
# 1. 按下 Win + X
# 2. 選擇「終端管理員」或「PowerShell (管理員)」

# Windows 10：
# 1. 搜索「PowerShell」
# 2. 右鍵「Windows PowerShell」→ 「以管理員身份執行」
```

### 第 2 步：導航到腳本目錄

```powershell
cd "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts"
```

### 第 3 步：執行設置腳本

```powershell
.\setup-watchdog-task.ps1
```

按照提示完成設置。腳本會：
- ✓ 驗證管理員權限
- ✓ 檢查監控腳本文件
- ✓ 建立 Windows 任務計劃程序
- ✓ 配置開機自動運行
- ✓ 立即啟動監控

---

## 📖 詳細設置步驟

### 方法 A：使用自動設置腳本（推薦）

```powershell
# 1. 以管理員身份打開 PowerShell

# 2. 導航到腳本目錄
cd "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts"

# 3. 執行設置腳本
.\setup-watchdog-task.ps1

# 按照提示完成設置
```

### 方法 B：手動配置任務計劃程序

如果自動腳本不工作，可以手動配置：

1. **打開任務計劃程序**
   - 按 Win + R
   - 輸入 `taskschd.msc`
   - 點擊「確定」

2. **建立新任務**
   - 右側面板：「建立基本任務」
   - 名稱：`Claude-Code-Watchdog`
   - 描述：`Claude Code 進程自動保活監控`
   - 點擊「下一步」

3. **設定觸發器**
   - 選擇「啟動時」（系統啟動時運行）
   - 點擊「下一步」

4. **設定動作**
   - 選擇「啟動程式」
   - 程式：`powershell.exe`
   - 引數：`-NoProfile -ExecutionPolicy Bypass -File "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-code-watchdog.ps1"`
   - 點擊「下一步」

5. **完成**
   - 確認設定
   - 點擊「完成」
   - 選擇「以最高權限執行」

---

## 🔧 配置說明

### 監控腳本配置

編輯 `claude-code-watchdog.ps1` 中的以下設定（約第 10 行）：

```powershell
$Script:CONFIG = @{
    ProcessName = "node"           # 進程名稱（通常是 node）
    CheckInterval = 10             # 檢查間隔（秒）→ 改小值監控更頻繁
    RestartDelay = 3               # 重啟延遲（秒）→ 崩潰後等待多久才重啟
    MaxRestarts = 5                # 時間窗口內最多重啟次數
    TimeWindow = 300               # 時間窗口（秒）= 5 分鐘
    LogFile = "$PSScriptRoot\claude-watchdog.log"
}
```

### 推薦的配置值

| 環境 | CheckInterval | RestartDelay | MaxRestarts | TimeWindow |
|------|---------------|--------------|-------------|------------|
| 高可靠性 | 10s | 5s | 10 | 300s |
| 即時響應 | 5s | 2s | 15 | 300s |
| 寬鬆環境 | 30s | 10s | 3 | 600s |

---

## 📊 監控狀態檢查

### 查看任務狀態

```powershell
# 獲取任務信息
Get-ScheduledTask -TaskName "Claude-Code-Watchdog" | Format-List

# 輸出示例
TaskPath                   : \Claude-Code-Watchdog
TaskName                   : Claude-Code-Watchdog
State                      : Running
Triggers                   : {MSFT_TaskBootTrigger}
Principal                  : SYSTEM
Description                : Claude Code 進程自動保活監控
```

### 檢查監控日誌

```powershell
# 查看最後 50 條日誌
Get-Content "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -Tail 50

# 實時監控日誌
Get-Content "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -Tail 50 -Wait
```

### 監控進程狀態

```powershell
# 查看 Claude Code 進程
Get-Process -Name "node" | Select-Object Id, ProcessName, Memory, CPU

# 輸出示例
Id    ProcessName   Memory        CPU
──    ───────────   ──────        ───
12345 node          234567890     1.5
```

---

## 🎮 常用命令

### 啟動/停止監控

```powershell
# 啟動監控任務
Start-ScheduledTask -TaskName "Claude-Code-Watchdog"

# 停止監控任務
Stop-ScheduledTask -TaskName "Claude-Code-Watchdog"

# 檢查任務是否正在運行
Get-ScheduledTask -TaskName "Claude-Code-Watchdog" | Select-Object State
```

### 編輯監控腳本

```powershell
# 用記事本編輯
notepad "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-code-watchdog.ps1"

# 用 VS Code 編輯
code "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-code-watchdog.ps1"
```

### 移除監控

```powershell
# 移除任務（停止監控）
Unregister-ScheduledTask -TaskName "Claude-Code-Watchdog" -Confirm:$false
```

---

## 🐛 故障排除

### 問題 1：腳本無法執行

**症狀：** 「執行策略禁止執行」

**解決：**
```powershell
# 以管理員身份運行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 問題 2：任務無法建立

**症狀：** 「拒絕訪問」

**解決：**
- 確保以管理員身份運行 PowerShell
- 檢查文件夾權限
- 嘗試手動方式（方法 B）

### 問題 3：監控腳本未啟動

**症狀：** Claude Code 崩潰後未自動重啟

**解決：**
```powershell
# 檢查任務狀態
Get-ScheduledTask -TaskName "Claude-Code-Watchdog" | Format-List

# 手動啟動任務
Start-ScheduledTask -TaskName "Claude-Code-Watchdog"

# 檢查日誌
Get-Content "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -Tail 100
```

### 問題 4：無法找到 Claude Code 進程

**症狀：** 日誌顯示「進程未啟動」

**解決：**
1. 檢查 Claude Code 是否已安裝
2. 確認進程名稱（編輯腳本中的 `ProcessName`）
3. 手動啟動 Claude Code
4. 查看進程名稱：`Get-Process | Where-Object {$_.ProcessName -like "*claude*"}`

---

## 📈 性能影響

| 項目 | 值 |
|------|-----|
| CPU 占用 | 遠低於 0.1%（大多數時間） |
| 內存占用 | 5-10 MB |
| 磁盤 I/O | 最小（僅寫日誌） |
| 檢查延遲 | 10 秒（可配置） |

---

## 📝 日誌文件

### 位置
```
C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log
```

### 日誌格式
```
[2026-11-12 10:30:45] [INFO] Claude Code 進程監控腳本已啟動
[2026-11-12 10:30:46] [SUCCESS] Claude Code 進程已啟動 (PID: 12345)
[2026-11-12 10:30:56] [INFO] 進程正常運行 (PID: 12345, 內存: 250.50 MB)
[2026-11-12 10:31:06] [ERROR] Claude Code 進程已崩潰
[2026-11-12 10:31:09] [WARN] 開始重啟 Claude Code... (原因: 進程崩潰)
[2026-11-12 10:31:12] [SUCCESS] Claude Code 已通過命令啟動
```

### 查看日誌

```powershell
# 最後 50 行
tail -f "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -n 50

# 或使用 PowerShell
Get-Content "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -Tail 50
```

---

## ✅ 驗證設置

執行以下命令驗證設置是否成功：

```powershell
# 1. 檢查任務是否存在
Get-ScheduledTask -TaskName "Claude-Code-Watchdog"

# 2. 檢查任務是否運行
(Get-ScheduledTask -TaskName "Claude-Code-Watchdog").State

# 3. 檢查日誌文件是否存在並有內容
Test-Path "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log"

# 4. 檢查最近的日誌記錄
Get-Content "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\scripts\claude-watchdog.log" -Tail 5
```

**成功的輸出應該是：**
```
✓ 任務存在
✓ 任務狀態為 Running
✓ 日誌文件存在且可讀
✓ 日誌中有最近的記錄
```

---

## 🎉 完成檢查表

設置完成後，確認以下項目：

- [ ] 以管理員身份執行了設置腳本
- [ ] 任務計劃程序中存在「Claude-Code-Watchdog」任務
- [ ] 任務狀態為「Running」或「Queued」
- [ ] 日誌文件有內容
- [ ] 手動停止 Claude Code，驗證它自動重啟

---

## 💡 最佳實踐

1. **定期檢查日誌**
   ```powershell
   # 每周檢查一次
   Get-Content "...\claude-watchdog.log" -Tail 100 | Select-Object -Last 20
   ```

2. **監控重啟次數**
   - 如果短時間內重啟次數過多，可能表示 Claude Code 有問題
   - 檢查 Claude Code 的日誌

3. **備份日誌**
   ```powershell
   # 定期備份日誌
   Copy-Item "...\claude-watchdog.log" "...\claude-watchdog-backup-$(Get-Date -Format yyyyMMdd).log"
   ```

4. **定期重啟系統**
   - 每月重啟一次，確保所有系統正常

5. **監控系統資源**
   - 確保系統有足夠的內存和 CPU

---

## 📞 技術支援

### 常見問題

**Q: 多久檢查一次進程？**
A: 默認每 10 秒檢查一次（可在配置中修改）

**Q: 進程崩潰多久後重啟？**
A: 檢測到崩潰後立即重啟（前面延遲 3 秒）

**Q: 最多重啟多少次？**
A: 5 分鐘內最多 10 次，超過後停止，防止無限迴圈

**Q: 重啟失敗時會怎樣？**
A: 記錄到日誌並生成告警，下一個檢查週期重試

**Q: 如何禁用監控？**
A: 執行 `Stop-ScheduledTask -TaskName "Claude-Code-Watchdog"`

---

## 版本信息

- **版本：** 1.0.0
- **最後更新：** 2026-11-12
- **支援系統：** Windows 10 / Windows 11
- **需要權限：** 管理員

---

**您的 Claude Code 現在已配置進程級保活監控！** 🎉

即使 Claude Code 發生崩潰或被意外關閉，系統也會自動重啟它。

如有問題，請檢查日誌文件或參考故障排除部分。
