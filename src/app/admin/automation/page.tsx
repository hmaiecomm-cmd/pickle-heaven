import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, NotOpen } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '自動化規則' }

export default async function AutomationPage() {
  if ((await pagePermission('monitor')) === 'forbidden') return <Forbidden />
  return (
    <NotOpen
      title="自動化規則"
      reason="預約前開燈、結束後延遲關燈、設備離線通知等規則，必須在真實設備支援下才能啟用。目前尚未串接設備閘道，因此不提供可啟用的規則，以免畫面顯示已啟用但現場沒有動作。"
      needs={[
        '串接燈控、門禁等設備閘道，並能回報指令執行結果',
        '感測器或其他現場狀態來源（關燈前需確認現場無人）',
        '每條規則的執行條件、作用場地、例外日期、暫停功能與操作紀錄',
        '關燈與結束使用前檢查後續預約與延長使用；不影響緊急逃生',
      ]}
      links={[
        { href: '/admin/settings/devices', label: '設備串接狀態' },
        { href: '/admin/control', label: '無人化控制' },
      ]}
    />
  )
}
