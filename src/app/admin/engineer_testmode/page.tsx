/**
 * 工程測試頁 — /admin/engineer_testmode
 *
 * 1. 一鍵切換連線對象：實體 IoT PC ↔ 網頁模擬器（場館 siteCode / siteCode-sim）
 * 2. 鏡像：目前連線對象回報的 16 路、門鎖、硬體、攝影機
 * 3. 下行參數：平台推給場館的計畫與指令；上行：Gateway 流量；錯誤 log
 * 4. 測試台：從雲端對場館電腦跑 20 多個情境（含邊界與故障）
 *
 * 日常操作仍在 /admin/devices、/admin/control、/admin/monitor?tab=cameras。
 */

import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { iotGatewayConfig } from '@/server/iot/gateway-client'
import { engineerVenues } from '@/server/iot/engineer'
import { EngineerClient } from './engineer-client'

export const metadata: Metadata = { title: '工程測試（IoT 場館電腦）' }
export const dynamic = 'force-dynamic'

export default async function EngineerTestModePage() {
  const ctx = await pagePermission('device.control')
  if (ctx === 'forbidden') return <Forbidden />
  const venues = await engineerVenues(ctx)
  return (
    <div>
      <PageTitle title="工程測試（IoT 場館電腦）" desc="切換實體場館電腦／網頁模擬器、看場館收到的參數與回報、跑測試情境。日常操作請用設備總覽、手動控制中心與即時監控。" />
      <EngineerClient venues={venues} configured={iotGatewayConfig() !== null} gatewayUrl={iotGatewayConfig()?.url ?? null} />
    </div>
  )
}
