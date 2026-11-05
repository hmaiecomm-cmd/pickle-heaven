'use client'

import * as React from 'react'
import { useAuth, type LineStatus } from '@/components/auth-provider'
import { checkLineFriend } from '@/server/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const yesNo = (v: boolean | null) => (v === null ? '無法判斷' : v ? '是' : '否')

export function LineCheckClient() {
  const { user, lineStatus } = useAuth()
  const [status, setStatus] = React.useState<LineStatus | null>(null)
  const [serverFriend, setServerFriend] = React.useState<boolean | null | undefined>(undefined)
  const [checking, setChecking] = React.useState(false)

  const check = React.useCallback(async () => {
    setChecking(true)
    const [s, f] = await Promise.all([lineStatus(), checkLineFriend().catch(() => null)])
    setStatus(s)
    setServerFriend(f)
    setChecking(false)
  }, [lineStatus])

  React.useEffect(() => {
    void check()
  }, [check])

  const rows: [string, string][] = [
    ['網站會員', user ? `${user.displayName}（${user.viaLine ? 'LINE 登入' : '非 LINE 登入'}）` : '未登入'],
    ['會員編號', user?.id ?? '—'],
    ['LINE 登入已設定', status ? yesNo(status.configured) : '檢查中…'],
    ['在 LINE App 內開啟', status ? yesNo(status.inClient) : '檢查中…'],
    ['LINE（LIFF）已登入', status ? yesNo(status.loggedIn) : '檢查中…'],
    ['已加官方帳號好友（伺服器查詢）', serverFriend === undefined ? '檢查中…' : yesNo(serverFriend)],
    ['已加官方帳號好友（LIFF 查詢）', status ? yesNo(status.friend) : '檢查中…'],
    ['錯誤訊息', status?.error ?? '無'],
  ]

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <h1 className="text-lg font-semibold tracking-tight">LINE 連線狀態</h1>
      <Card>
        <CardContent className="space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-muted">{k}</span>
              <span className="break-all text-right font-medium">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Button type="button" variant="secondary" onClick={() => void check()} loading={checking}>
        重新檢查
      </Button>
      <p className="text-xs text-muted">請將這個畫面截圖給網站管理者。</p>
    </div>
  )
}
