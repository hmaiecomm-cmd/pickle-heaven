import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { lineConfig, readNotice } from '@/server/admin-line-oauth'
import { AdminLoginForm } from './login-form'

export const metadata: Metadata = { title: '後台登入' }
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAdminUser()
  if (user) redirect('/admin')
  const params = await searchParams
  return <AdminLoginForm lineEnabled={lineConfig().configured} lineError={readNotice(params)} />
}
