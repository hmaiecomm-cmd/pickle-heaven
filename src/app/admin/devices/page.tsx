import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { DeviceManager } from '@/components/admin/device-manager'

export const metadata: Metadata = { title: '設備總覽' }
export const dynamic = 'force-dynamic'

export default async function DevicesPage() {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') return <Forbidden />
  const canEditSchedule = can(ctx.role, 'device.automation')

  return (
    <div className="space-y-5">
      <PageTitle
        title="設備總覽與智慧排程"
        desc="管理球館燈光、風扇、電力設備及自動排程；門禁開門、上鎖及授權由門禁權限管理獨立處理。"
      />
      <DemoModeBanner what="電力與設備硬體" />
      <DeviceManager canEditSchedule={canEditSchedule} />
    </div>
  )
}
