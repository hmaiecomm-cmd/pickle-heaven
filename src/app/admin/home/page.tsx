import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { redirect } from 'next/navigation'
import { EditorFullC } from './editor-full-c'

/**
 * 官網頁面管理頁面（C 版：主題套版）
 * 四款主題、內容編輯、版本管理、發布管理
 */

export const dynamic = 'force-dynamic'
export const metadata = {
  title: '官網頁面管理',
}

export default async function HomeEditorPage() {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'settings')) {
    redirect('/admin/login')
  }

  return <EditorFullC username={ctx.username} />
}
