import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export async function ProductsTab({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('marketing')) === 'forbidden') return <Forbidden />

  return (
    <div>
      <PageTitle title="商品訂單" desc="此功能尚未開放。" />
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
        <p>此功能尚未開放</p>
      </div>
    </div>
  )
}
