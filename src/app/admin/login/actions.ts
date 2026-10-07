'use server'

import { redirect } from 'next/navigation'
import { signInAdmin, signOutAdmin } from '@/lib/admin-auth'

export type LoginState = { error?: string }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!username || !password) return { error: '請輸入帳號與密碼' }

  const res = await signInAdmin(username, password)
  if (!res.ok) return { error: res.error }

  // 首次登入或密碼被重設：先更換密碼
  redirect(res.mustChangePassword ? '/admin/change-password' : '/admin')
}

export async function logoutAction(): Promise<void> {
  await signOutAdmin()
  redirect('/admin/login')
}
