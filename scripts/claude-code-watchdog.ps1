# Claude Code 進程保活監控腳本
# 用途：在 Windows 級別監控 Claude Code 進程，崩潰時自動重啟
# 執行方式：以管理員身份在 PowerShell 中運行

# ─── 配置 ───
$Script:CONFIG = @{
    ProcessName = "node"  # Claude Code 使用 Node.js 運行
    CheckInterval = 10  # 檢查間隔（秒）
    RestartDelay = 3  # 重啟延遲（秒）
    MaxRestarts = 5  # 時間窗口內最多重啟次數
    TimeWindow = 300  # 時間窗口（秒）
    LogFile = "$PSScriptRoot\claude-watchdog.log"
    CrashThreshold = 10  # 秒內連續 3 次崩潰視為異常
}

$Script:State = @{
    ProcessId = $null
    RestartCount = 0
    LastRestartTime = $null
    CrashHistory = @()
    IsRestarting = $false
}

# ─── 日誌函式 ───
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    # 寫入控制台
    switch ($Level) {
        "INFO" { Write-Host $logEntry -ForegroundColor Cyan }
        "WARN" { Write-Host $logEntry -ForegroundColor Yellow }
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
    }

    # 寫入日誌文件
    Add-Content -Path $Script:CONFIG.LogFile -Value $logEntry
}

# ─── 初始化 ───
function Initialize {
    Write-Log "Claude Code 進程監控腳本已啟動" "INFO"
    Write-Log "配置: 檢查間隔 $($Script:CONFIG.CheckInterval) 秒" "INFO"

    # 檢查是否以管理員身份運行
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Log "警告：未以管理員身份運行，某些功能可能無法使用" "WARN"
    }
}

# ─── 尋找 Claude Code 進程 ───
function Get-ClaudeCodeProcess {
    # 尋找包含 "claude" 的 node.exe 進程
    # 或者尋找任何非系統的 node.exe 進程

    try {
        # 方法 1：尋找所有 node.exe 進程
        $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue

        if ($processes) {
            # 如果有多個，選擇第一個
            if ($processes -is [array]) {
                return $processes[0]
            }
            return $processes
        }

        # 方法 2：尋找 Claude 相關進程
        $claudeProcess = Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | Select-Object -First 1
        if ($claudeProcess) {
            return $claudeProcess
        }

        return $null
    }
    catch {
        Write-Log "尋找進程失敗: $_" "ERROR"
        return $null
    }
}

# ─── 檢查進程狀態 ───
function Check-ProcessHealth {
    try {
        $process = Get-ClaudeCodeProcess

        if ($process) {
            # 進程正在運行
            $Script:State.ProcessId = $process.Id
            return @{
                Status = "RUNNING"
                ProcessId = $process.Id
                ProcessName = $process.ProcessName
                Memory = [math]::Round($process.WorkingSet / 1MB, 2)
                CPU = $process.CPU
            }
        }
        else {
            # 進程未運行
            if ($null -eq $Script:State.ProcessId) {
                return @{
                    Status = "NOT_STARTED"
                    Message = "Claude Code 進程未啟動"
                }
            }
            else {
                return @{
                    Status = "CRASHED"
                    Message = "Claude Code 進程已崩潰"
                }
            }
        }
    }
    catch {
        return @{
            Status = "ERROR"
            Message = "檢查失敗: $_"
        }
    }
}

# ─── 檢查是否應該重啟 ───
function Should-Restart {
    # 檢查是否正在重啟
    if ($Script:State.IsRestarting) {
        return $false
    }

    # 檢查重啟次數是否超過限制
    if ($Script:State.RestartCount -ge $Script:CONFIG.MaxRestarts) {
        $timeSinceLastRestart = (Get-Date) - $Script:State.LastRestartTime

        if ($timeSinceLastRestart.TotalSeconds -gt $Script:CONFIG.TimeWindow) {
            # 時間窗口已過，重置計數
            $Script:State.RestartCount = 0
            return $true
        }

        Write-Log "重啟次數已達上限 ($($Script:State.RestartCount)/$($Script:CONFIG.MaxRestarts))，等待時間窗口恢復" "WARN"
        return $false
    }

    return $true
}

# ─── 重啟 Claude Code ───
function Restart-ClaudeCode {
    param([string]$Reason = "未指定")

    if ($Script:State.IsRestarting) {
        Write-Log "已在重啟中，跳過此次重啟" "WARN"
        return
    }

    $Script:State.IsRestarting = $true

    try {
        Write-Log "開始重啟 Claude Code... (原因: $Reason)" "WARN"

        # 等待重啟延遲
        Start-Sleep -Seconds $Script:CONFIG.RestartDelay

        # 嘗試啟動 Claude Code
        # 根據您的實際安裝位置修改以下命令

        # 選項 1：使用 claude 命令（如已添加到 PATH）
        try {
            Start-Process -FilePath "claude" -ArgumentList "code" -WindowStyle Normal
            Write-Log "Claude Code 已通過命令啟動" "SUCCESS"
        }
        catch {
            # 選項 2：直接運行可執行檔
            Write-Log "命令行啟動失敗，嘗試直接執行..." "WARN"

            # 修改以下路徑為您的 Claude Code 安裝位置
            $claudePath = "C:\Program Files\Claude Code\claude.exe"
            if (Test-Path $claudePath) {
                Start-Process -FilePath $claudePath -WindowStyle Normal
                Write-Log "Claude Code 已通過可執行檔啟動" "SUCCESS"
            }
            else {
                Write-Log "找不到 Claude Code 可執行檔: $claudePath" "ERROR"
                return
            }
        }

        # 更新狀態
        $Script:State.LastRestartTime = Get-Date
        $Script:State.RestartCount += 1

        # 等待進程啟動
        Start-Sleep -Seconds 2

        # 驗證進程是否啟動
        $newProcess = Get-ClaudeCodeProcess
        if ($newProcess) {
            $Script:State.ProcessId = $newProcess.Id
            Write-Log "Claude Code 進程已啟動 (PID: $($newProcess.Id))" "SUCCESS"
        }
        else {
            Write-Log "進程啟動後未能偵測到，可能需要手動檢查" "WARN"
        }
    }
    catch {
        Write-Log "重啟過程出錯: $_" "ERROR"
    }
    finally {
        $Script:State.IsRestarting = $false
    }
}

# ─── 主監控迴圈 ───
function Start-Monitoring {
    Initialize

    while ($true) {
        try {
            $health = Check-ProcessHealth

            switch ($health.Status) {
                "RUNNING" {
                    Write-Host -NoNewline "." # 進度指示
                    # 記錄定期的成功檢查（每 10 次）
                    if ([int](Get-Date -UFormat %s) % 100 -eq 0) {
                        Write-Log "進程正常運行 (PID: $($health.ProcessId), 內存: $($health.Memory) MB)" "INFO"
                    }
                }

                "NOT_STARTED" {
                    Write-Log $health.Message "WARN"
                    if (Should-Restart) {
                        Restart-ClaudeCode "進程未啟動"
                    }
                }

                "CRASHED" {
                    Write-Log $health.Message "ERROR"

                    # 記錄崩潰
                    $Script:State.CrashHistory += @{
                        Timestamp = Get-Date
                        Reason = "進程意外終止"
                    }

                    # 保留最近 50 次崩潰記錄
                    if ($Script:State.CrashHistory.Count -gt 50) {
                        $Script:State.CrashHistory = $Script:State.CrashHistory[-50..-1]
                    }

                    if (Should-Restart) {
                        Restart-ClaudeCode "進程崩潰"
                    }
                }

                "ERROR" {
                    Write-Log $health.Message "ERROR"
                }
            }

            # 等待指定的檢查間隔
            Start-Sleep -Seconds $Script:CONFIG.CheckInterval
        }
        catch {
            Write-Log "監控迴圈異常: $_" "ERROR"
            Start-Sleep -Seconds 5
        }
    }
}

# ─── 信號處理 ───
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Write-Log "監控腳本已停止" "INFO"
}

# ─── 啟動監控 ───
Start-Monitoring
