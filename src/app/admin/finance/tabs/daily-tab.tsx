import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'

export async function DailyTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
        <p>日結與對帳內容載入中...</p>
        <p className="mt-2 text-xs text-amber-600">此標籤將顯示日結與對帳管理頁面</p>
      </div>
    </div>
  )
}
