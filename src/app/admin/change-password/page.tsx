import type { Metadata } from 'next'
import { getAdminContext } from '@/lib/admin-auth'
import { ChangePasswordForm } from './change-password-form'

export const metadata: Metadata = { title: '更換密碼' }
export const dynamic = 'force-dynamic'

/** 首次登入（或密碼被重設後）必須更換密碼；平時也可自行更換 */
export default async function ChangePasswordPage() {
  const ctx = await getAdminContext()
  return <ChangePasswordForm forced={Boolean(ctx?.mustChangePassword)} username={ctx?.username ?? ''} />
}
