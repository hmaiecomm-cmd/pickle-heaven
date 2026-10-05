import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminEmail } from '@/lib/admin-auth'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { AdminLoginForm } from './login-form'

export const metadata: Metadata = { title: '後台登入' }
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const email = await getAdminEmail()
  if (email) redirect('/admin')

  return <AdminLoginForm supabaseReady={isSupabaseConfigured()} />
}
