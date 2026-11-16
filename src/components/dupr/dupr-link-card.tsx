'use client'

import { AlertCircle, Check, Loader2, Trophy, Trash2 } from 'lucide-react'

export interface DuprPlayerData {
  duprPlayerId: string
  playerName: string
  singlesRating: number
  doublesRating: number
  linkedAt: Date
  ratingUpdatedAt: Date
}

export interface DuprLinkCardProps {
  linked: boolean
  playerData?: DuprPlayerData | null
  onLinkClick: () => void
  onUnlinkClick: () => void
  onSyncClick?: () => Promise<void>
  isLoading?: boolean
  isSyncing?: boolean
}

export function DuprLinkCard({
  linked,
  playerData,
  onLinkClick,
  onUnlinkClick,
  onSyncClick,
  isLoading,
  isSyncing,
}: DuprLinkCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl surface p-6">
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl surface p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-brand-600" />
        <h3 className="text-lg font-semibold">DUPR 智慧賽事系統</h3>
      </div>

      {!linked ? (
        // 未連結狀態
        <div className="space-y-4">
          <p className="text-sm text-muted">
            連結您的 DUPR 帳號，查看評級與賽事記錄
          </p>
          <button
            onClick={onLinkClick}
            className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            立即連結
          </button>
        </div>
      ) : playerData ? (
        // 已連結狀態
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted">球員名稱</p>
            <p className="text-base font-semibold">{playerData.playerName}</p>
            <p className="text-xs text-muted">ID: {playerData.duprPlayerId}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg surface-2 p-3">
              <p className="text-xs text-muted mb-1">單打評級</p>
              <p className="text-2xl font-bold text-brand-600">
                {playerData.singlesRating.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg surface-2 p-3">
              <p className="text-xs text-muted mb-1">雙打評級</p>
              <p className="text-2xl font-bold text-brand-600">
                {playerData.doublesRating.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="text-xs text-muted space-y-1">
            <p>
              連結時間：
              {new Date(playerData.linkedAt).toLocaleDateString('zh-TW')}
            </p>
            <p>
              評級更新：
              {new Date(playerData.ratingUpdatedAt).toLocaleDateString('zh-TW')}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            {onSyncClick && (
              <button
                onClick={onSyncClick}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 rounded-lg border border-border hover:surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    刷新評級
                  </>
                )}
              </button>
            )}
            <button
              onClick={onUnlinkClick}
              className="flex-1 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium text-red-600 flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              解除連結
            </button>
          </div>
        </div>
      ) : (
        // 連結狀態異常
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">
            連結狀態異常，請重新連結
          </p>
        </div>
      )}
    </div>
  )
}
