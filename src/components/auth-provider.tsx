'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { checkLineFriend, devLogin, loginWithLine, logout as logoutAction } from '@/server/actions'
import { useToast } from '@/components/ui/toast'
import type { SessionUser } from '@/lib/types'

/**
 * 前台登入狀態。只提供 LINE 登入：透過 LIFF 取得 id_token，交由伺服器向 LINE 驗證（loginWithLine）。
 * 本站只保存 HttpOnly session Cookie，前端不接觸任何密碼。
 */
interface AuthState {
  user: SessionUser | null
  /** LINE 登入（LIFF）是否已設定 */
  lineConfigured: boolean
  /** 伺服器暫時無法確認登入狀態（資料庫故障）：不顯示登入入口，提示重試 */
  unavailable: boolean
  loggingIn: boolean
  /** LINE 登入；next 為登入完成後要回到的站內路徑，預設為目前頁面 */
  login: (next?: string) => void
  logout: () => Promise<void>
  /** 是否已加 LINE 官方帳號好友；LINE 未登入或無法判斷時為 null */
  lineFriendship: () => Promise<boolean | null>
  /** LIFF 連線狀態（/line-check 診斷用） */
  lineStatus: () => Promise<LineStatus>
}

export interface LineStatus {
  configured: boolean
  inClient: boolean | null
  loggedIn: boolean | null
  friend: boolean | null
  /** 無法判斷時的原因（LIFF 錯誤碼與訊息） */
  error: string | null
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

/* ────────────────────────────── LIFF ────────────────────────────── */

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
/** 會員按過登出後，本分頁內不再自動以 LINE 登入（LINE App 內 LIFF 永遠是登入狀態） */
const LINE_LOGGED_OUT_KEY = 'ph_line_logged_out'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Liff = any

let liffPromise: Promise<Liff> | null = null

/** 載入 LINE 官方 LIFF SDK 並初始化（整個頁面只做一次） */
function loadLiff(liffId: string): Promise<Liff> {
  liffPromise ??= new Promise<Liff>((resolve, reject) => {
    const w = window as unknown as { liff?: Liff }
    const init = () => w.liff.init({ liffId }).then(() => resolve(w.liff), reject)
    if (w.liff) return void init()
    const script = document.createElement('script')
    script.src = LIFF_SDK_URL
    script.async = true
    script.onload = init
    script.onerror = () => reject(new Error('無法載入 LINE 登入元件'))
    document.head.appendChild(script)
  }).catch((err) => {
    liffPromise = null
    throw err
  })
  return liffPromise
}

/** LINE App 內開啟，或剛從 LINE 登入畫面導回：一進頁面就初始化 LIFF */
function shouldInitLiffOnLoad(): boolean {
  if (/\bLine\//i.test(navigator.userAgent)) return true
  const sp = new URLSearchParams(window.location.search)
  return sp.has('liffClientId') || sp.has('liff.state')
}

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(key, '1')
    else sessionStorage.removeItem(key)
  } catch {
    /* 私密模式等無法寫入時忽略 */
  }
}

export function AuthProvider({
  children,
  initialUser,
  lineLiffId = null,
  devLoginEnabled = false,
  unavailable = false,
}: {
  children: React.ReactNode
  initialUser: SessionUser | null
  /** LIFF ID；未設定（或伺服器缺 LINE Channel ID）時為 null，不顯示 LINE 按鈕 */
  lineLiffId?: string | null
  /** 僅本機開發：LINE 按鈕改以測試會員登入（localhost 無法走 LIFF） */
  devLoginEnabled?: boolean
  unavailable?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = React.useState<SessionUser | null>(initialUser)
  const [loggingIn, setLoggingIn] = React.useState(false)
  const userRef = React.useRef(initialUser)
  userRef.current = user

  // 伺服器端 session 變動（登入回呼、登出）後同步
  React.useEffect(() => setUser(initialUser), [initialUser])

  /** 已在 LINE 登入：把 id_token 交給伺服器驗證並建立本站 session */
  const completeLineLogin = React.useCallback(
    async (liff: Liff) => {
      const idToken: string | null = liff.getIDToken()
      const res = idToken ? await loginWithLine(idToken) : { ok: false as const, error: '無法取得 LINE 登入資料，請再試一次' }
      if (!res.ok) {
        // 外部瀏覽器登出 LIFF，下次按鈕會重新走 LINE 登入取得新的 id_token
        if (!liff.isInClient()) liff.logout()
        throw new Error(res.error)
      }
      writeFlag(LINE_LOGGED_OUT_KEY, false)
      router.refresh()
    },
    [router],
  )

  // LINE App 內或剛從 LINE 登入導回：初始化 LIFF，已登入 LINE 但尚無本站 session 時自動帶入
  React.useEffect(() => {
    if (!lineLiffId || !shouldInitLiffOnLoad()) return
    let cancelled = false
    loadLiff(lineLiffId)
      .then(async (liff) => {
        if (cancelled) return
        if (userRef.current || !liff.isLoggedIn() || readFlag(LINE_LOGGED_OUT_KEY)) return
        setLoggingIn(true)
        await completeLineLogin(liff)
      })
      .catch((err: Error) => {
        console.error('[liff] 初始化或登入失敗', err)
        if (!cancelled) toast(err.message || 'LINE 登入失敗，請再試一次', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoggingIn(false)
      })
    return () => {
      cancelled = true
    }
  }, [lineLiffId, completeLineLogin, toast])

  const login = React.useCallback(
    (next?: string) => {
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
      if (!lineLiffId) {
        toast('LINE 登入尚未設定，請聯絡場館', 'error')
        return
      }
      // 只允許回到站內路徑，避免開放式轉址
      const raw = next ?? currentPath()
      const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account'
      setLoggingIn(true)
      writeFlag(LINE_LOGGED_OUT_KEY, false)
      void loadLiff(lineLiffId)
        .then(async (liff) => {
          if (!liff.isLoggedIn()) {
            // 導向 LINE 登入畫面，完成後回到 target（頁面會重新載入）
            liff.login({ redirectUri: new URL(target, window.location.origin).toString() })
            return
          }
          await completeLineLogin(liff)
          if (target !== currentPath()) router.push(target)
          setLoggingIn(false)
        })
        .catch((err: Error) => {
          toast(err.message || 'LINE 登入失敗，請再試一次', 'error')
          setLoggingIn(false)
        })
    },
    [devLoginEnabled, lineLiffId, completeLineLogin, router, toast],
  )

  const logout = React.useCallback(async () => {
    await logoutAction()
    writeFlag(LINE_LOGGED_OUT_KEY, true)
    if (liffPromise) {
      void liffPromise
        .then((liff) => {
          if (liff.isLoggedIn() && !liff.isInClient()) liff.logout()
        })
        .catch(() => {})
    }
    setUser(null)
    router.refresh()
  }, [router])

  // 需 LINE 登入頻道已連結官方帳號（Linked LINE Official Account），LIFF 才查得到好友狀態
  const lineStatus = React.useCallback(async (): Promise<LineStatus> => {
    const status: LineStatus = { configured: Boolean(lineLiffId), inClient: null, loggedIn: null, friend: null, error: null }
    if (!lineLiffId) return status
    try {
      const liff = await loadLiff(lineLiffId)
      status.inClient = liff.isInClient()
      status.loggedIn = liff.isLoggedIn()
      if (!status.loggedIn) return status
      const { friendFlag } = await liff.getFriendship()
      status.friend = Boolean(friendFlag)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      status.error = [e?.code, e?.message].filter(Boolean).join(' ') || String(err)
      console.warn('[liff] 無法取得好友狀態', err)
    }
    return status
  }, [lineLiffId])

  // 先由伺服器向 Messaging API 查（任何瀏覽器都可用），查不到再退回 LIFF
  const lineFriendship = React.useCallback(async () => {
    const viaServer = await checkLineFriend().catch(() => null)
    return viaServer ?? (await lineStatus()).friend
  }, [lineStatus])

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      lineConfigured: Boolean(lineLiffId) || devLoginEnabled,
      unavailable,
      loggingIn,
      login,
      logout,
      lineFriendship,
      lineStatus,
    }),
    [user, devLoginEnabled, lineLiffId, unavailable, loggingIn, login, logout, lineFriendship, lineStatus],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
