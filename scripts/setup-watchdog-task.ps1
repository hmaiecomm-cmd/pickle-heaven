# Windows 任務計劃程序設置腳本
# 用途：自動註冊 Claude Code 進程監控腳本到任務計劃程序
# 執行方式：以管理員身份在 PowerShell 中運行
#
# 使用方法：
#   .\setup-watchdog-task.ps1

# ─── 檢查管理員權限 ───
function Test-AdminRights {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-AdminRights)) {
    Write-Host "❌ 此腳本必須以管理員身份運行" -ForegroundColor Red
    Write-Host "請右鍵點擊 PowerShell → 以管理員身份運行" -ForegroundColor Yellow
    exit 1
}

# ─── 配置 ───
$TaskName = "Claude-Code-Watchdog"
$TaskDescription = "Claude Code 進程自動保活監控 - 異常終止時自動重啟"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition | Join-Path -ChildPath "claude-code-watchdog.ps1"
$LogPath = Split-Path -Parent $ScriptPath | Join-Path -ChildPath "claude-watchdog.log"

Write-Host "Claude Code 進程監控設置工具" -ForegroundColor Cyan
Write-Host "════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── 驗證腳本路徑 ───
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ 錯誤：找不到監控腳本" -ForegroundColor Red
    Write-Host "預期位置: $ScriptPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ 監控腳本已找到" -ForegroundColor Green
Write-Host "  路徑: $ScriptPath" -ForegroundColor Gray
Write-Host ""

# ─── 檢查現有任務 ───
Write-Host "檢查現有任務..." -ForegroundColor Cyan

try {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if ($existingTask) {
        Write-Host "✓ 找到現有任務: $TaskName" -ForegroundColor Green
        Write-Host ""

        # 詢問是否更新
        $confirm = Read-Host "是否更新現有任務？ (Y/N)"
        if ($confirm -ne "Y" -and $confirm -ne "y") {
            Write-Host "已取消操作" -ForegroundColor Yellow
            exit 0
        }

        # 移除現有任務
        Write-Host "移除現有任務..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✓ 現有任務已移除" -ForegroundColor Green
        Write-Host ""
    }
}
catch {
    Write-Host "檢查現有任務時出錯: $_" -ForegroundColor Yellow
}

# ─── 建立任務觸發器 ───
Write-Host "建立任務觸發器..." -ForegroundColor Cyan

# 1. 系統啟動時運行
$startupTrigger = New-ScheduledTaskTrigger -AtStartup

# 2. 每 1 分鐘檢查一次任務（確保腳本持續運行）
$repeatTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 365)

Write-Host "✓ 觸發器已建立" -ForegroundColor Green
Write-Host "  - 系統啟動時運行" -ForegroundColor Gray
Write-Host "  - 每 1 分鐘驗證一次" -ForegroundColor Gray
Write-Host ""

# ─── 建立任務動作 ───
Write-Host "建立任務動作..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

Write-Host "✓ 任務動作已建立" -ForegroundColor Green
Write-Host "  執行檔: powershell.exe" -ForegroundColor Gray
Write-Host "  腳本: $ScriptPath" -ForegroundColor Gray
Write-Host ""

# ─── 建立任務設定 ───
Write-Host "建立任務設定..." -ForegroundColor Cyan

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -DontStopIfGoingOnBatteries `
    -WakeToRun:$true `
    -MultipleInstances IgnoreNew

Write-Host "✓ 任務設定已建立" -ForegroundColor Green
Write-Host "  - 允許在電池電源下運行" -ForegroundColor Gray
Write-Host "  - 系統可用時立即啟動" -ForegroundColor Gray
Write-Host "  - 防止多重啟動" -ForegroundColor Gray
Write-Host ""

# ─── 建立任務 ───
Write-Host "建立排定任務..." -ForegroundColor Cyan

try {
    $task = Register-ScheduledTask `
        -TaskName $TaskName `
        -Description $TaskDescription `
        -Trigger $startupTrigger `
        -Action $action `
        -Settings $settings `
        -RunLevel Highest `
        -User "SYSTEM" `
        -Force

    Write-Host "✓ 任務已成功建立" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "❌ 建立任務失敗: $_" -ForegroundColor Red
    exit 1
}

# ─── 驗證任務 ───
Write-Host "驗證任務..." -ForegroundColor Cyan

$verifyTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($verifyTask) {
    Write-Host "✓ 任務驗證成功" -ForegroundColor Green
    Write-Host "  名稱: $($verifyTask.TaskName)" -ForegroundColor Gray
    Write-Host "  狀態: $($verifyTask.State)" -ForegroundColor Gray
    Write-Host "  上次運行: $($verifyTask.LastRunTime)" -ForegroundColor Gray
    Write-Host ""
}
else {
    Write-Host "❌ 任務驗證失敗" -ForegroundColor Red
    exit 1
}

# ─── 設置信息 ───
Write-Host "════════════════════════════════" -ForegroundColor Cyan
Write-Host "設置完成！" -ForegroundColor Green
Write-Host "════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 任務信息：" -ForegroundColor Cyan
Write-Host "  任務名稱: $TaskName" -ForegroundColor Gray
Write-Host "  監控腳本: $ScriptPath" -ForegroundColor Gray
Write-Host "  日誌文件: $LogPath" -ForegroundColor Gray
Write-Host ""

Write-Host "🎯 工作流程：" -ForegroundColor Cyan
Write-Host "  1. 系統啟動時，任務計劃程序自動執行監控腳本" -ForegroundColor Gray
Write-Host "  2. 監控腳本持續檢查 Claude Code 進程（每 10 秒一次）" -ForegroundColor Gray
Write-Host "  3. 如果進程崩潰，自動重啟 Claude Code" -ForegroundColor Gray
Write-Host "  4. 所有操作記錄到日誌文件" -ForegroundColor Gray
Write-Host ""

Write-Host "📝 查看日誌：" -ForegroundColor Cyan
Write-Host "  Get-Content -Path '$LogPath' -Tail 50 -Wait" -ForegroundColor Gray
Write-Host ""

Write-Host "⚙️  常見命令：" -ForegroundColor Cyan
Write-Host "  查看任務: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  啟動任務: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  停止任務: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  移除任務: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ 所有設置已完成！系統將在下次啟動時自動運行監控。" -ForegroundColor Green
Write-Host ""

# ─── 詢問是否立即啟動 ───
$startNow = Read-Host "是否立即啟動監控任務？ (Y/N)"
if ($startNow -eq "Y" -or $startNow -eq "y") {
    Write-Host "啟動任務..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2

    $runningTask = Get-ScheduledTask -TaskName $TaskName
    if ($runningTask.State -eq "Running") {
        Write-Host "✓ 任務已啟動，監控腳本正在運行" -ForegroundColor Green
    }
    else {
        Write-Host "⚠ 任務狀態: $($runningTask.State)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "設置完成！" -ForegroundColor Cyan
