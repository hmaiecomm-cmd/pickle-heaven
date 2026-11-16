'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react'

export interface DuprAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  onError?: (error: string) => void
}

export function DuprAuthDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: DuprAuthDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)

  useEffect(() => {
    if (!open) {
      setLoading(false)
      setError(null)
    }
  }, [open])

  // 監聽來自 callback 頁面的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 驗證來源（正式環境應該驗證 origin）
      if (event.data?.type === 'dupr-auth-success') {
        popupRef.current?.close()
        onOpenChange(false)
        onSuccess()
      } else if (event.data?.type === 'dupr-auth-error') {
        setError(event.data.error || '授權失敗')
        onError?.(event.data.error)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange, onSuccess, onError])

  const handleAuth = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. 調用 /api/auth/dupr/authorize 取得授權 URL
      const res = await fetch('/api/auth/dupr/authorize', {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '無法取得授權 URL')
      }

      const { authUrl } = await res.json()

      // 2. 打開新視窗導向授權頁面
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      popupRef.current = window.open(
        authUrl,
        'dupr-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popupRef.current) {
        throw new Error('無法打開授權視窗，請檢查瀏覽器設置')
      }

      // 3. 監聽 popup 是否被關閉（用戶取消）
      const checkInterval = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(checkInterval)
          setLoading(false)
          // 用戶可能關閉了視窗但授權成功，等待 postMessage
          // 所以不立即顯示錯誤
        }
      }, 500)
    } catch (err) {
      const message = err instanceof Error ? err.message : '授權失敗'
      setError(message)
      onError?.(message)
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* 對話框 */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="rounded-xl surface p-6 space-y-4 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold">連結 DUPR 帳號</h2>
            <p className="text-sm text-muted mt-1">
              點擊下方按鈕以 DUPR 帳號進行授權
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  授權中...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  前往授權
                </>
              )}
            </button>

            <button
              onClick={() => !loading && onOpenChange(false)}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg border border-border hover:surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              取消
            </button>
          </div>

          <p className="text-xs text-muted text-center">
            系統會在新視窗打開 DUPR 授權頁面
          </p>
        </div>
      </div>
    </>
  )
}
