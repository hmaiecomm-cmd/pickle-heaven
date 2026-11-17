import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { VenueLayoutMap } from '@/components/venue/venue-layout-map'

export const metadata: Metadata = { title: '設施地圖' }
export const dynamic = 'force-dynamic'

export default async function VenueMapPage() {
  const ctx = await pagePermission('courts')
  if (ctx === 'forbidden') return <Forbidden />
  return <div className="space-y-6"><PageTitle title="設施地圖" desc="場館設備與設施配置" /><VenueLayoutMap /></div>
}
