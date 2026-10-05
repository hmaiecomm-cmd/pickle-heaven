import 'server-only'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, isSupabaseConfigured } from './supabase/server'

/**
 * 後台身分驗證。
 *
 * 管理者使用 Supabase Auth（Email + 密碼）登入，
 * 並且必須列於 ADMIN_EMAILS 白名單中才具備後台權限。
 */
export async function getAdminEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    // 本機開發尚未接上 Supabase 時的暫時通道；正式環境永遠不會啟用
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === '1') {
      return 'dev@localhost'
    }
    return null
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  const email = data.user?.email
  if (error || !email) return null

  const allowList = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // 未設定白名單時，任何已登入的 Supabase 帳號都會被拒絕，避免誤開放
  if (allowList.length === 0) {
    console.warn('[admin] 未設定 ADMIN_EMAILS，拒絕所有後台存取')
    return null
  }
  if (!allowList.includes(email.toLowerCase())) return null

  return email
}

export async function requireAdmin(): Promise<string> {
  const email = await getAdminEmail()
  if (!email) redirect('/admin/login')
  return email
}
