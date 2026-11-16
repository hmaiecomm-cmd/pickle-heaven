'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight } from 'lucide-react'

export default function DuprLinkSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const playerName = searchParams.get('playerName') || '球員'
  const singlesRating = searchParams.get('singlesRating') || '0'
  const doublesRating = searchParams.get('doublesRating') || '0'
  const playerId = searchParams.get('playerId') || ''

  // 3 秒後自動返回帳戶頁面
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/account?tab=dupr')
    }, 3000)
    return () => clearTimeout(timer)
  }, [router])

  const handleReturn = () => {
    router.push('/account?tab=dupr')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
      <div className="w-full max-w-md">
        <div className="rounded-xl surface p-8 space-y-6 shadow-lg">
          {/* 成功圖標 */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-600 rounded-full opacity-20 blur-lg" />
              <CheckCircle className="h-16 w-16 text-green-600 relative" />
            </div>
          </div>

          {/* 標題 */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">連結成功！</h1>
            <p className="text-sm text-muted">您的 DUPR 帳號已成功連結</p>
          </div>

          {/* 球員信息 */}
          <div className="space-y-3 p-4 rounded-lg surface-2">
            <div>
              <p className="text-xs text-muted mb-1">球員名稱</p>
              <p className="text-base font-semibold">{playerName}</p>
            </div>

            {playerId && (
              <div>
                <p className="text-xs text-muted mb-1">DUPR ID</p>
                <p className="text-sm font-mono text-muted">{playerId}</p>
              </div>
            )}
          </div>

          {/* 評級展示 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg surface-2 p-4 text-center">
              <p className="text-xs text-muted mb-2">單打評級</p>
              <p className="text-3xl font-bold text-brand-600">
                {parseFloat(singlesRating).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg surface-2 p-4 text-center">
              <p className="text-xs text-muted mb-2">雙打評級</p>
              <p className="text-3xl font-bold text-brand-600">
                {parseFloat(doublesRating).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 提示 */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              💡 系統將在 3 秒後返回帳戶頁面
            </p>
          </div>

          {/* 按鈕 */}
          <button
            onClick={handleReturn}
            className="w-full px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
          >
            返回帳戶
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-xs text-muted mt-4">
          您現在可以在帳戶頁面查看和管理 DUPR 連結
        </p>
      </div>
    </div>
  )
}
