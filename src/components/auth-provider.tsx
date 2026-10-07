'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { devLogin, logout as logoutAction } from '@/server/actions'
import { useToast } from '@/components/ui/toast'
import type { SessionUser } from '@/lib/types'

/**
 * 前台登入狀態。
 * 登入一律導向 /api/auth/google/start，由 Google 官方畫面完成驗證；
 * 本站只保存 HttpOnly session Cookie，前端不接觸任何密碼或 token。
 */
interface AuthState {
  user: SessionUser | null
  /** Google 授權是否已設定；未設定時按鈕改為說明文字，不假裝可登入 */
  googleConfigured: boolean
  loggingIn: boolean
  /** 導向 Google 登入；next 為登入完成後要回到的站內路徑，預設為目前頁面 */
  login: (next?: string) => void
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必須在 <AuthProvider> 內使用')
  return ctx
}

/** 目前頁面的站內路徑（含查詢字串），供登入後返回 */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const url = new URL(window.location.href)
  url.searchParams.delete('auth')
  return `${url.pathname}${url.search}${url.hash}`
}

const AUTH_MESSAGES: Record<string, { text: string; kind: 'info' | 'error' }> = {
  cancelled: { text: '已取消 Google 登入', kind: 'info' },
  failed: { text: 'Google 登入失敗，請再試一次', kind: 'error' },
  unavailable: { text: 'Google 登入尚未設定，請聯絡場館', kind: 'error' },
  expired: { text: '登入已逾時，請重新登入', kind: 'info' },
}

export function AuthProvider({
  children,
  initialUser,
  googleConfigured,
  devLoginEnabled = false,
}: {
  children: React.ReactNode
  initialUser: SessionUser | null
  googleConfigured: boolean
  /** 僅本機開發：以測試會員登入，不經 Google */
  devLoginEnabled?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = React.useState<SessionUser | null>(initialUser)
  const [loggingIn, setLoggingIn] = React.useState(false)

  // 伺服器端 session 變動（登入回呼、登出）後同步
  React.useEffect(() => setUser(initialUser), [initialUser])

  // 授權回呼帶回的結果：提示一次並從網址移除
  React.useEffect(() => {
    const url = new URL(window.location.href)
    const auth = url.searchParams.get('auth')
    if (!auth) return
    const msg = AUTH_MESSAGES[auth]
    if (msg) toast(msg.text, msg.kind)
    url.searchParams.delete('auth')
    window.history.replaceState(null, '', url.toString())
  }, [toast])

  const login = React.useCallback(
    (next?: string) => {
      const target = next ?? currentPath()
      if (googleConfigured) {
        setLoggingIn(true)
        window.location.assign(`/api/auth/google/start?next=${encodeURIComponent(target)}`)
        return
      }
      if (devLoginEnabled) {
        setLoggingIn(true)
        void devLogin()
          .then((res) => {
            if (!res.ok) throw new Error(res.error)
            setUser(res.user)
            router.refresh()
          })
          .catch((err: Error) => toast(err.message, 'error'))
          .finally(() => setLoggingIn(false))
        return
      }
      toast(AUTH_MESSAGES.unavailable.text, 'error')
    },
    [devLoginEnabled, googleConfigured, router, toast],
  )

  const logout = React.useCallback(async () => {
    await logoutAction()
    setUser(null)
    router.refresh()
  }, [router])

  const value = React.useMemo<AuthState>(
    () => ({ user, googleConfigured: googleConfigured || devLoginEnabled, loggingIn, login, logout }),
    [user, googleConfigured, devLoginEnabled, loggingIn, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
