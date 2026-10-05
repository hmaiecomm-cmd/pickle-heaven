'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { devLogin, loginWithLine, logout as logoutAction } from '@/server/actions'
import type { SessionUser } from '@/lib/types'

interface LiffState {
  user: SessionUser | null
  /** 是否在 LINE App 內開啟 */
  inClient: boolean
  ready: boolean
  loggingIn: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  /** 於 LINE 內分享訊息；非 LINE 環境回傳 false */
  shareBooking: (text: string, url: string) => Promise<boolean>
  /** 關閉 MINI App 視窗（僅 LINE 內有效） */
  closeWindow: () => void
}

const LiffContext = React.createContext<LiffState | null>(null)

export function useLiff(): LiffState {
  const ctx = React.useContext(LiffContext)
  if (!ctx) throw new Error('useLiff 必須在 <LiffProvider> 內使用')
  return ctx
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Liff = any

export function LiffProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: SessionUser | null
}) {
  const router = useRouter()
  const [user, setUser] = React.useState<SessionUser | null>(initialUser)
  const [inClient, setInClient] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [loggingIn, setLoggingIn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const liffRef = React.useRef<Liff | null>(null)

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  const devLoginEnabled = process.env.NEXT_PUBLIC_DEV_LOGIN === '1'

  // LIFF 初始化：只做初始化與環境偵測，不強迫登入，
  // 讓使用者可以先瀏覽場地與時段，加入購物車後再登入。
  React.useEffect(() => {
    let cancelled = false

    async function init() {
      if (!liffId) {
        setReady(true)
        return
      }
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })
        if (cancelled) return
        liffRef.current = liff
        setInClient(liff.isInClient())

        // 已在 LINE 登入但尚未建立本站 session → 自動帶入
        if (liff.isLoggedIn() && !initialUser) {
          const idToken = liff.getIDToken()
          if (idToken) {
            const res = await loginWithLine(idToken)
            if (!cancelled && res.ok) {
              setUser(res.user)
              router.refresh()
            }
          }
        }
      } catch (err) {
        console.error('[liff] 初始化失敗', err)
        if (!cancelled) setError('LINE 初始化失敗，請重新開啟或改用瀏覽器登入')
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
    // 僅於掛載時執行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = React.useCallback(async () => {
    setLoggingIn(true)
    setError(null)
    try {
      const liff = liffRef.current

      if (liff) {
        if (!liff.isLoggedIn()) {
          // 導向 LINE 登入，完成後會回到目前頁面
          liff.login({ redirectUri: window.location.href })
          return
        }
        const idToken = liff.getIDToken()
        if (!idToken) throw new Error('無法取得 LINE id_token')
        const res = await loginWithLine(idToken)
        if (!res.ok) throw new Error(res.error)
        setUser(res.user)
        router.refresh()
        return
      }

      // 非 LINE 環境（本機開發或桌機瀏覽器）
      if (devLoginEnabled) {
        const res = await devLogin()
        if (!res.ok) throw new Error(res.error)
        setUser(res.user)
        router.refresh()
        return
      }

      throw new Error('請透過 LINE 開啟本服務以完成登入')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗')
    } finally {
      setLoggingIn(false)
    }
  }, [devLoginEnabled, router])

  const logout = React.useCallback(async () => {
    await logoutAction()
    setUser(null)
    try {
      liffRef.current?.logout?.()
    } catch {
      /* 忽略 */
    }
    router.refresh()
  }, [router])

  const shareBooking = React.useCallback(async (text: string, url: string) => {
    const liff = liffRef.current
    if (!liff?.isApiAvailable?.('shareTargetPicker')) return false
    try {
      await liff.shareTargetPicker([{ type: 'text', text: `${text}\n${url}` }])
      return true
    } catch {
      return false
    }
  }, [])

  const closeWindow = React.useCallback(() => {
    try {
      liffRef.current?.closeWindow?.()
    } catch {
      /* 忽略 */
    }
  }, [])

  const value = React.useMemo<LiffState>(
    () => ({ user, inClient, ready, loggingIn, error, login, logout, shareBooking, closeWindow }),
    [user, inClient, ready, loggingIn, error, login, logout, shareBooking, closeWindow],
  )

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>
}
