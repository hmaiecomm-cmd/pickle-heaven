import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { DeviceConfigMap } from '@/components/admin/device-config-map'
import { ElectricalCircuitsList } from '@/components/admin/electrical-circuits-list'

export const metadata: Metadata = { title: '智慧設備管理' }
export const dynamic = 'force-dynamic'

export default async function DevicesPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-6">
      <PageTitle
        title="智慧設備管理"
        desc="管理球館設備配置、電力迴路控制、自動化規則與遠端控制。"
      />

      <DemoModeBanner what="電力與設備硬體" />

      {/* 設備配置圖 */}
      <section>
        <h2 className="text-sm font-semibold mb-4">球館設備配置圖</h2>
        <DeviceConfigMap />
      </section>

      {/* 18 路電力迴路 */}
      <section>
        <h2 className="text-sm font-semibold mb-4">18 路電力迴路管理</h2>
        <ElectricalCircuitsList />
      </section>
    </div>
  )
}
