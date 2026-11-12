/**
 * Remote Control Watchdog 管理頁面
 */

import { RemoteControlWatchdogClient } from './remote-control-watchdog-client'

export default function RemoteControlWatchdogPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        {/* 頁面標題 */}
        <div>
          <h1 className="text-3xl font-bold">Remote Control Watchdog</h1>
          <p className="text-muted-foreground mt-2">
            監控 Claude Code 與手機 Claude 的連線狀態，並自動管理重連
          </p>
        </div>

        {/* 狀態概覽 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">🎯 功能概覽</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start">
              <span className="text-xl mr-3">🔄</span>
              <div>
                <p className="font-semibold">自動監控</p>
                <p className="text-xs text-muted-foreground">每 15 秒檢測連線狀態</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-xl mr-3">🔌</span>
              <div>
                <p className="font-semibold">自動重連</p>
                <p className="text-xs text-muted-foreground">斷訊時自動重試（最多 10 次）</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-xl mr-3">⏰</span>
              <div>
                <p className="font-semibold">指數退避</p>
                <p className="text-xs text-muted-foreground">重試延遲從 5 秒到 5 分鐘</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-xl mr-3">📱</span>
              <div>
                <p className="font-semibold">跨設備支持</p>
                <p className="text-xs text-muted-foreground">支持多個手機 Claude 連接</p>
              </div>
            </div>
          </div>
        </div>

        {/* Watchdog 客戶端 */}
        <div>
          <RemoteControlWatchdogClient />
        </div>

        {/* 故障排除指南 */}
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold text-sm mb-3">❓ 故障排除指南</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-yellow-700 mb-1">問題：「已斷訊」狀態一直保持</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 ml-2">
                <li>確認手機已連接到穩定的網路</li>
                <li>確認手機上的 Claude 應用仍在執行</li>
                <li>嘗試點擊「手動重連」按鈕</li>
                <li>重啟手機上的 Claude 應用（完全關閉後重新開啟）</li>
                <li>檢查防火牆設定，確保沒有阻擋連線</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-yellow-700 mb-1">問題：重連嘗試次數很高 (&gt; 5 次)</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 ml-2">
                <li>檢查網路連線品質</li>
                <li>查看手機上 Claude 的日誌，尋找連線錯誤</li>
                <li>嘗試在不同的網路環境下測試（如：手機熱點）</li>
                <li>確認 Claude Code 和手機 Claude 的版本是最新的</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-yellow-700 mb-1">問題：Claude Code 重啟後無法自動重連</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 ml-2">
                <li>確認 Remote Control Watchdog 服務已啟動</li>
                <li>檢查 Claude Code 的日誌輸出</li>
                <li>手動點擊「手動重連」按鈕</li>
                <li>如果仍無法連接，重啟手機上的 Claude 應用</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 快速參考 */}
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold text-sm mb-3">🚀 快速參考</h2>
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-2 py-1">參數</th>
                <th className="text-left px-2 py-1">值</th>
                <th className="text-left px-2 py-1">說明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">心跳間隔</td>
                <td className="px-2 py-1">15 秒</td>
                <td className="px-2 py-1">Watchdog 檢測連線的頻率</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">心跳超時</td>
                <td className="px-2 py-1">30 秒</td>
                <td className="px-2 py-1">心跳信號的等待時間</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">初始重連延遲</td>
                <td className="px-2 py-1">5 秒</td>
                <td className="px-2 py-1">第一次重試的等待時間</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">最大重連延遲</td>
                <td className="px-2 py-1">5 分鐘</td>
                <td className="px-2 py-1">重試延遲的上限</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">最大重試次數</td>
                <td className="px-2 py-1">10 次</td>
                <td className="px-2 py-1">給定後停止重連</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1 font-mono">退避倍數</td>
                <td className="px-2 py-1">1.5x</td>
                <td className="px-2 py-1">每次重試的延遲增長倍數</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 重要提示 */}
        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">ℹ️ 提示：</span>
            Remote Control Watchdog 是一個自動監控系統，可在 Claude Code 或手機 Claude 發生連線問題時自動恢復。
            它不會替代 Remote Control 本身的連線管理，而是提供額外的可靠性保障。
          </p>
        </div>
      </div>
    </div>
  )
}
