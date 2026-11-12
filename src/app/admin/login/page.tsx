import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { AdminLoginForm } from './login-form'

export const metadata: Metadata = { title: '後台登入' }
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const user = await getAdminUser()
  if (user) redirect('/admin')

  return <AdminLoginForm />
}
