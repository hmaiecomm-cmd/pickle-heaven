import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { DeviceManager } from '@/components/admin/device-manager'

export const metadata: Metadata = { title: '智慧設備管理' }
export const dynamic = 'force-dynamic'

export default async function DevicesPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-5">
      <PageTitle title="智慧設備管理" desc="球館平面配置、設備狀態與 18 路電力迴路。" />
      <DemoModeBanner what="電力與設備硬體" />
      <DeviceManager />
    </div>
  )
}
