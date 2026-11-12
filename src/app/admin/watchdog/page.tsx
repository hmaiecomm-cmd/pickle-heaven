/**
 * Watchdog 告警頁面 — /admin/watchdog
 *
 * 功能：
 * 1. 查看開啟、已確認、已解決的告警
 * 2. 人工確認或解決告警
 * 3. Watchdog 摘要
 * 4. 手動執行檢測
 */

import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { WatchdogClient } from './watchdog-client'

export const metadata: Metadata = { title: 'Watchdog 監控' }
export const dynamic = 'force-dynamic'

export default async function WatchdogPage() {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return <Forbidden />

  return (
    <div>
      <PageTitle
        title="Watchdog 監控"
        desc="實時監測系統各環節的健康狀態，包括 MQTT、設備、命令、排程、日誌同步等。"
      />
      <WatchdogClient />
    </div>
  )
}
