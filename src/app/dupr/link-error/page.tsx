'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react'

export default function DuprLinkErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const error = searchParams.get('error') || '未知錯誤'
  const description = searchParams.get('description') || ''

  const errorMessages: Record<string, { title: string; icon?: string }> = {
    invalid_request: {
      title: '請求無效',
    },
    invalid_state: {
      title: 'CSRF 驗證失敗',
    },
    callback_failed: {
      title: '帳號連結失敗',
    },
    server_error: {
      title: '伺服器錯誤',
    },
    access_denied: {
      title: '您拒絕了授權',
    },
  }

  const errorInfo = errorMessages[error] || {
    title: '連結失敗',
  }

  const handleRetry = () => {
    router.push('/account?tab=dupr')
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
      <div className="w-full max-w-md">
        <div className="rounded-xl surface p-8 space-y-6 shadow-lg">
          {/* 錯誤圖標 */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-600 rounded-full opacity-20 blur-lg" />
              <AlertCircle className="h-16 w-16 text-red-600 relative" />
            </div>
          </div>

          {/* 標題 */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">連結失敗</h1>
            <p className="text-sm text-muted">{errorInfo.title}</p>
          </div>

          {/* 錯誤詳情 */}
          <div className="space-y-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div>
              <p className="text-xs text-muted mb-1">錯誤碼</p>
              <p className="text-sm font-mono text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>

            {description && (
              <div>
                <p className="text-xs text-muted mb-1">詳細信息</p>
                <p className="text-sm text-red-600 dark:text-red-400 break-words">
                  {decodeURIComponent(description)}
                </p>
              </div>
            )}
          </div>

          {/* 可能的原因 */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              可能的原因：
            </p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <li>• DUPR 帳號已連結到其他使用者</li>
              <li>• 您拒絕了授權請求</li>
              <li>• 網路連接出現問題</li>
              <li>• DUPR 服務暫時無法使用</li>
            </ul>
          </div>

          {/* 建議 */}
          <div className="space-y-2 text-xs text-muted">
            <p>💡 <strong>建議：</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>重新整理頁面後再試一次</li>
              <li>確認您使用的 DUPR 帳號未連結其他使用者</li>
              <li>檢查網路連接</li>
              <li>聯繫技術支援</li>
            </ul>
          </div>

          {/* 按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:surface-2 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              重新嘗試
            </button>
          </div>

          {/* 返回帳戶 */}
          <button
            onClick={() => router.push('/account?tab=dupr')}
            className="w-full px-4 py-2.5 rounded-lg border border-border text-muted hover:text-[rgb(var(--fg))] hover:surface-2 transition-colors text-sm font-medium"
          >
            返回帳戶頁面
          </button>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-xs text-muted mt-4">
          如果問題持續，請與客服聯繫
        </p>
      </div>
    </div>
  )
}
