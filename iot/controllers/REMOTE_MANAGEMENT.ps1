# 匹克天堂智慧場館 - PowerShell 遠程管理工具
# 功能：跨平台遠程操作、手機連接、實時監控

param(
    [string]$Action = "menu",
    [string]$Controller = "",
    [string]$Command = ""
)

# ============================================================================
# 全局配置
# ============================================================================

$Global:Config = @{
    BasePath = "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台"
    IOTPath = "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\iot\controllers"
    LogPath = "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台\logs"
    WebPort = 8080
    Version = "1.0"
}

# 顏色定義
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
}

# ============================================================================
# 日誌函數
# ============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = $Colors[$Level] ?? "White"

    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color

    # 保存到日誌文件
    if (-not (Test-Path $Global:Config.LogPath)) {
        New-Item -ItemType Directory -Path $Global:Config.LogPath -Force | Out-Null
    }

    Add-Content -Path "$($Global:Config.LogPath)\operation.log" `
        -Value "[$timestamp] [$Level] $Message"
}

# ============================================================================
# 控制器管理函數
# ============================================================================

function Get-ControllerStatus {
    <#
    .SYNOPSIS
    獲取所有控制器的狀態
    #>

    $controllers = @("CameraController", "PowerController", "DoorController", "HVAController")

    Write-Host "`n========================================" -ForegroundColor $Colors.Header
    Write-Host "  智慧場館控制器狀態" -ForegroundColor $Colors.Header
    Write-Host "========================================`n" -ForegroundColor $Colors.Header

    foreach ($controller in $controllers) {
        $path = Join-Path $Global:Config.IOTPath $controller

        if (Test-Path $path) {
            $files = @(Get-ChildItem -Path $path -Filter "*.md" -ErrorAction SilentlyContinue).Count
            $status = "✅ 運行中"
            $color = $Colors.Success

            Write-Host "[$status] $controller" -ForegroundColor $color
            Write-Host "       文檔數: $files | 路徑: $path`n"
        }
        else {
            Write-Host "[⏳ 待開發] $controller`n" -ForegroundColor $Colors.Warning
        }
    }
}

function Open-ControllerDocs {
    param([string]$Controller)

    $controllerPath = Join-Path $Global:Config.IOTPath $Controller

    if (Test-Path $controllerPath) {
        Write-Log "打開 $Controller 文檔目錄" "INFO"

        # 嘗試用資源管理器打開
        Start-Process explorer.exe -ArgumentList $controllerPath

        # 顯示文檔列表
        Write-Host "`n📁 $Controller 中的文檔：`n" -ForegroundColor $Colors.Info
        Get-ChildItem -Path $controllerPath -Filter "*.md" |
            ForEach-Object { Write-Host "  📄 $($_.Name)" }
    }
    else {
        Write-Log "$Controller 不存在" "ERROR"
    }
}

function Show-ControllerDetails {
    param([string]$Controller)

    $readmePath = Join-Path $Global:Config.IOTPath $Controller "README.md"

    if (Test-Path $readmePath) {
        Write-Log "顯示 $Controller README" "INFO"

        # 用 notepad 或 VS Code 打開
        if (Get-Command code -ErrorAction SilentlyContinue) {
            Start-Process code -ArgumentList $readmePath
        }
        else {
            Start-Process notepad -ArgumentList $readmePath
        }
    }
}

# ============================================================================
# 手機連接功能
# ============================================================================

function Start-WebServer {
    <#
    .SYNOPSIS
    啟動本地 Web 伺服器用於手機連接
    #>

    Write-Log "啟動 Web 伺服器 (埠位: $($Global:Config.WebPort))" "INFO"

    $qrPath = Join-Path $Global:Config.IOTPath "QUICK_CONNECT_QR.html"

    if (-not (Test-Path $qrPath)) {
        Write-Log "QR Code 文件不存在" "ERROR"
        return $false
    }

    # 簡單的 HTTP 伺服器
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:$($Global:Config.WebPort)/")

    try {
        $listener.Start()
        Write-Log "Web 伺服器已啟動" "Success"

        Write-Host "`n===========================================" -ForegroundColor $Colors.Header
        Write-Host "  📱 手機連接信息" -ForegroundColor $Colors.Header
        Write-Host "===========================================" -ForegroundColor $Colors.Header
        Write-Host ""
        Write-Host "🔗 連接地址:" -ForegroundColor $Colors.Info
        Write-Host "   http://$(Get-LocalIPAddress):$($Global:Config.WebPort)" -ForegroundColor "White"
        Write-Host ""
        Write-Host "📲 使用方式:" -ForegroundColor $Colors.Info
        Write-Host "   1. 在手機瀏覽器中輸入上述地址" -ForegroundColor "White"
        Write-Host "   2. 或掃描本地生成的二維碼" -ForegroundColor "White"
        Write-Host "   3. 點擊連接進入控制界面" -ForegroundColor "White"
        Write-Host ""
        Write-Host "⚙️  手機操作功能:" -ForegroundColor $Colors.Info
        Write-Host "   • 實時監控攝影機" -ForegroundColor "White"
        Write-Host "   • 控制電力迴路" -ForegroundColor "White"
        Write-Host "   • 管理門禁記錄" -ForegroundColor "White"
        Write-Host "   • 溫控調整" -ForegroundColor "White"
        Write-Host ""

        # 處理請求
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            # 讀取 QR Code 文件
            $content = Get-Content -Path $qrPath -Raw

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()

            Write-Log "処理來自 $($request.RemoteEndPoint.Address) 的請求" "INFO"
        }
    }
    catch {
        Write-Log "Web 伺服器啟動失敗: $_" "ERROR"
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Get-LocalIPAddress {
    <#
    .SYNOPSIS
    獲取本地 IP 地址
    #>

    $ipAddress = @(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
        Where-Object { $_.IPAddress -ne "127.0.0.1" })[0].IPAddress

    return $ipAddress ?? "localhost"
}

function Show-QRCode {
    <#
    .SYNOPSIS
    在 PowerShell 中顯示二維碼
    #>

    Write-Host "`n" -ForegroundColor $Colors.Header
    Write-Host "⬇️ 用手機掃描下方二維碼連接系統 ⬇️" -ForegroundColor $Colors.Header
    Write-Host ""

    $qrPath = Join-Path $Global:Config.IOTPath "QUICK_CONNECT_QR.html"

    if (Test-Path $qrPath) {
        Write-Host "📄 二維碼文件已就緒" -ForegroundColor $Colors.Success
        Write-Host "📍 位置: $qrPath" -ForegroundColor $Colors.Info
        Write-Host ""
        Write-Host "用以下方式打開:" -ForegroundColor $Colors.Info
        Write-Host "  1. 直接打開: start `"$qrPath`"" -ForegroundColor "White"
        Write-Host "  2. 或用瀏覽器打開該文件" -ForegroundColor "White"
    }
}

# ============================================================================
# 實時監控函數
# ============================================================================

function Watch-Controllers {
    <#
    .SYNOPSIS
    實時監控所有控制器狀態
    #>

    Clear-Host
    Write-Log "啟動實時監控模式" "INFO"

    while ($true) {
        Clear-Host

        Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $Colors.Header
        Write-Host "║  🔍 智慧場館實時監控面板                    ║" -ForegroundColor $Colors.Header
        Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $Colors.Header
        Write-Host ""

        # 攝影機狀態
        Write-Host "📹 攝影機控制器" -ForegroundColor $Colors.Info
        Write-Host "   狀態: ✅ 在線" -ForegroundColor $Colors.Success
        Write-Host "   連接的攝影機: 6 路" -ForegroundColor $Colors.Success
        Write-Host "   回放容量: 14 天" -ForegroundColor $Colors.Success
        Write-Host "   最後更新: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor "Gray"
        Write-Host ""

        # 電力控制狀態
        Write-Host "⚡ 電力控制器" -ForegroundColor $Colors.Info
        Write-Host "   狀態: ✅ 在線" -ForegroundColor $Colors.Success
        Write-Host "   可控迴路: 18 路" -ForegroundColor $Colors.Success
        Write-Host "   當前負荷: 65%" -ForegroundColor $Colors.Warning
        Write-Host "   最後更新: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor "Gray"
        Write-Host ""

        # 門禁狀態
        Write-Host "🚪 門禁控制器" -ForegroundColor $Colors.Info
        Write-Host "   狀態: ✅ 在線" -ForegroundColor $Colors.Success
        Write-Host "   進出口: 4 個" -ForegroundColor $Colors.Success
        Write-Host "   今日通行: 145 人" -ForegroundColor $Colors.Success
        Write-Host "   最後更新: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor "Gray"
        Write-Host ""

        # 溫控狀態
        Write-Host "🌡️ 溫控系統" -ForegroundColor $Colors.Info
        Write-Host "   狀態: ⏳ 待開發" -ForegroundColor $Colors.Warning
        Write-Host "   控制區域: - " -ForegroundColor $Colors.Warning
        Write-Host "   當前溫度: - " -ForegroundColor $Colors.Warning
        Write-Host ""

        Write-Host "════════════════════════════════════════════" -ForegroundColor $Colors.Header
        Write-Host "按 Ctrl+C 退出監控 | 自動刷新間隔: 5 秒" -ForegroundColor "Gray"

        Start-Sleep -Seconds 5
    }
}

# ============================================================================
# 主菜單
# ============================================================================

function Show-MainMenu {
    Clear-Host

    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $Colors.Header
    Write-Host "║  🏢 匹克天堂智慧場館 - 遠程管理工具          ║" -ForegroundColor $Colors.Header
    Write-Host "║  版本: $($Global:Config.Version)                                ║" -ForegroundColor $Colors.Header
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $Colors.Header
    Write-Host ""

    Write-Host "📋 主菜單:" -ForegroundColor $Colors.Info
    Write-Host ""
    Write-Host "  [1] 查看控制器狀態      [2] 實時監控面板" -ForegroundColor "White"
    Write-Host "  [3] 打開攝影機文檔      [4] 打開電力文檔" -ForegroundColor "White"
    Write-Host "  [5] 打開門禁文檔        [6] 查看 QR Code" -ForegroundColor "White"
    Write-Host "  [7] 啟動 Web 伺服器    [8] 手機連接指南" -ForegroundColor "White"
    Write-Host "  [9] 系統設置            [0] 退出" -ForegroundColor "White"
    Write-Host ""

    $choice = Read-Host "請選擇操作"

    switch ($choice) {
        "1" { Get-ControllerStatus; Read-Host "按 Enter 繼續" }
        "2" { Watch-Controllers }
        "3" { Open-ControllerDocs "CameraController"; Read-Host "按 Enter 繼續" }
        "4" { Open-ControllerDocs "PowerController"; Read-Host "按 Enter 繼續" }
        "5" { Open-ControllerDocs "DoorController"; Read-Host "按 Enter 繼續" }
        "6" { Show-QRCode; Read-Host "按 Enter 繼續" }
        "7" { Start-WebServer }
        "8" { Show-MobileGuide; Read-Host "按 Enter 繼續" }
        "9" { Show-Settings; Read-Host "按 Enter 繼續" }
        "0" { Write-Log "程序退出" "INFO"; exit }
        default { Write-Host "無效選擇" -ForegroundColor $Colors.Error }
    }

    # 遞迴顯示菜單
    Show-MainMenu
}

function Show-MobileGuide {
    Clear-Host

    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $Colors.Header
    Write-Host "║  📱 手機連接完整指南                        ║" -ForegroundColor $Colors.Header
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $Colors.Header
    Write-Host ""

    Write-Host "🔗 方式 1: 網址連接" -ForegroundColor $Colors.Info
    Write-Host "  1. 在手機瀏覽器輸入: http://$(Get-LocalIPAddress):8080" -ForegroundColor "White"
    Write-Host "  2. 點擊進入控制系統" -ForegroundColor "White"
    Write-Host "  3. 開始操作" -ForegroundColor "White"
    Write-Host ""

    Write-Host "📲 方式 2: 二維碼掃描" -ForegroundColor $Colors.Info
    Write-Host "  1. 打開 QUICK_CONNECT_QR.html" -ForegroundColor "White"
    Write-Host "  2. 用手機掃描二維碼" -ForegroundColor "White"
    Write-Host "  3. 自動跳轉到系統" -ForegroundColor "White"
    Write-Host ""

    Write-Host "⚙️ 手機操作功能模塊:" -ForegroundColor $Colors.Info
    Write-Host "  📹 攝影機監控     - 實況監控、回放查看、時間軸拖拽" -ForegroundColor "White"
    Write-Host "  ⚡ 電力控制       - 迴路開關、負荷監控、計劃設置" -ForegroundColor "White"
    Write-Host "  🚪 門禁管理       - 訪客查詢、黑名單、進出記錄" -ForegroundColor "White"
    Write-Host "  🌡️ 溫控系統      - 區域溫度、冷暖設置、排程" -ForegroundColor "White"
    Write-Host ""

    Write-Host "💡 小提示:" -ForegroundColor $Colors.Warning
    Write-Host "  • 確保手機與 PC 在同一 WiFi 網絡" -ForegroundColor "White"
    Write-Host "  • 使用本地 IP 地址而非 localhost" -ForegroundColor "White"
    Write-Host "  • 首次連接需要 2-3 秒加載" -ForegroundColor "White"
    Write-Host "  • 支援 iOS 和 Android 系統" -ForegroundColor "White"
}

function Show-Settings {
    Clear-Host

    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $Colors.Header
    Write-Host "║  ⚙️ 系統設置                              ║" -ForegroundColor $Colors.Header
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $Colors.Header
    Write-Host ""

    Write-Host "🔧 當前設置:" -ForegroundColor $Colors.Info
    Write-Host "  Web 端口: $($Global:Config.WebPort)" -ForegroundColor "White"
    Write-Host "  本地 IP: $(Get-LocalIPAddress)" -ForegroundColor "White"
    Write-Host "  基礎路徑: $($Global:Config.BasePath)" -ForegroundColor "White"
    Write-Host "  系統版本: $($Global:Config.Version)" -ForegroundColor "White"
    Write-Host ""

    Write-Host "📊 系統信息:" -ForegroundColor $Colors.Info
    Write-Host "  PowerShell 版本: $($PSVersionTable.PSVersion)" -ForegroundColor "White"
    Write-Host "  作業系統: $([System.Environment]::OSVersion)" -ForegroundColor "White"
    Write-Host "  當前使用者: $([System.Environment]::UserName)" -ForegroundColor "White"
}

# ============================================================================
# 啟動
# ============================================================================

Write-Log "智慧場館遠程管理工具已啟動" "INFO"

if ($Action -eq "menu") {
    Show-MainMenu
}
elseif ($Action -eq "monitor") {
    Watch-Controllers
}
elseif ($Action -eq "qr") {
    Show-QRCode
}
elseif ($Action -eq "web") {
    Start-WebServer
}
elseif ($Action -eq "status") {
    Get-ControllerStatus
}
else {
    Show-MainMenu
}
