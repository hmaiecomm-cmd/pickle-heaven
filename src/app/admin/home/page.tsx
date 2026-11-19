import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { redirect } from 'next/navigation'
import { EditorFullV5 } from './editor-full-v5'

/**
 * 官網頁面管理頁面（Phase 2b+3：場館故事 & 訪問資訊 & 邀請區照片編輯）
 * 後台主題套版、內容編輯、發布管理
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

  return <EditorFullV5 username={ctx.username} />
}
