'use client'

import { useEffect, useState } from 'react'
import { DuprLinkCard, type DuprPlayerData } from '@/components/dupr/dupr-link-card'
import { DuprAuthDialog } from '@/components/dupr/dupr-auth-dialog'

export default function DuprTabPage() {
  const [linked, setLinked] = useState(false)
  const [playerData, setPlayerData] = useState<DuprPlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSyncing, setSyncing] = useState(false)

  // 查詢連結狀態
  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dupr/me')
      const { success, linked: isLinked, data } = await res.json()

      if (success) {
        setLinked(isLinked)
        setPlayerData(data)
      }
    } catch (error) {
      console.error('[DUPR] 查詢連結狀態失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始化：查詢連結狀態
  useEffect(() => {
    fetchStatus()
  }, [])

  // 解除連結
  const handleUnlink = async () => {
    if (!confirm('確定要解除 DUPR 帳號連結嗎？')) {
      return
    }

    try {
      const res = await fetch('/api/dupr/link', { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        setLinked(false)
        setPlayerData(null)
        alert('已解除連結')
      } else {
        alert(`解除連結失敗: ${data.error}`)
      }
    } catch (error) {
      console.error('[DUPR] 解除連結失敗:', error)
      alert('解除連結失敗，請稍後重試')
    }
  }

  // 同步評級
  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch('/api/dupr/sync-ratings', { method: 'POST' })
      const data = await res.json()

      if (data.success && data.data) {
        // 更新本地狀態
        setPlayerData((prev) =>
          prev
            ? {
                ...prev,
                singlesRating: data.data.singlesRating,
                doublesRating: data.data.doublesRating,
                ratingUpdatedAt: new Date(data.data.syncedAt),
              }
            : null
        )
        alert('評級已同步')
      } else {
        alert(`同步失敗: ${data.error}`)
      }
    } catch (error) {
      console.error('[DUPR] 同步評級失敗:', error)
      alert('同步失敗，請稍後重試')
    } finally {
      setSyncing(false)
    }
  }

  // OAuth 授權成功回調
  const handleAuthSuccess = () => {
    fetchStatus()
  }

  // OAuth 授權失敗回調
  const handleAuthError = (error: string) => {
    console.error('[DUPR] 授權錯誤:', error)
  }

  return (
    <div className="space-y-4">
      <DuprLinkCard
        linked={linked}
        playerData={playerData}
        onLinkClick={() => setDialogOpen(true)}
        onUnlinkClick={handleUnlink}
        onSyncClick={linked ? handleSync : undefined}
        isLoading={loading}
        isSyncing={isSyncing}
      />

      <DuprAuthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleAuthSuccess}
        onError={handleAuthError}
      />

      {/* 提示信息 */}
      {!linked && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm space-y-2">
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            💡 關於 DUPR 連結
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>連結您的 DUPR 帳號以查看評級和賽事記錄</li>
            <li>您的 Token 將被安全地加密存儲</li>
            <li>您可以隨時解除連結</li>
          </ul>
        </div>
      )}
    </div>
  )
}
