import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { AccessDevicesList } from '@/components/admin/access-devices-list'
import { AccessGrantsManager } from '@/components/admin/access-grants-manager'
import { AccessEventsLog } from '@/components/admin/access-events-log'

export const metadata: Metadata = { title: '門禁權限管理' }
export const dynamic = 'force-dynamic'

export default async function AccessPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-6">
      <PageTitle
        title="門禁權限管理"
        desc="管理門禁設備、預約授權、使用者權限與進出紀錄。"
      />

      {/* 門禁設備列表 */}
      <section>
        <h2 className="text-sm font-semibold mb-4">門禁設備</h2>
        <AccessDevicesList />
      </section>

      {/* 權限授予管理 */}
      <section>
        <h2 className="text-sm font-semibold mb-4">權限管理</h2>
        <AccessGrantsManager />
      </section>

      {/* 進出紀錄 */}
      <section>
        <h2 className="text-sm font-semibold mb-4">進出紀錄</h2>
        <AccessEventsLog />
      </section>
    </div>
  )
}
