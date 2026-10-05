'use server'

import { redirect } from 'next/navigation'
import { signInAdmin, signOutAdmin } from '@/lib/admin-auth'

export type LoginState = { error?: string }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!username || !password) return { error: '請輸入帳號與密碼' }

  const ok = await signInAdmin(username, password)
  if (!ok) return { error: '帳號或密碼錯誤' }

  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  await signOutAdmin()
  redirect('/admin/login')
}
