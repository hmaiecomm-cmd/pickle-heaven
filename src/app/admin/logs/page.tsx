/**
 * 日誌檢視頁面 — /admin/logs
 *
 * 功能：
 * 1. 查詢事件日誌（時間、類型、嚴重程度）
 * 2. 事件時間線追蹤（預約→命令→回報）
 * 3. CSV 匯出
 * 4. 同步狀態檢視
 */

import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { LogsClient } from './logs-client'

export const metadata: Metadata = { title: '日誌檢視' }
export const dynamic = 'force-dynamic'

export default async function LogsPage() {
  const ctx = await pagePermission('audit')
  if (ctx === 'forbidden') return <Forbidden />

  return (
    <div>
      <PageTitle
        title="日誌檢視"
        desc="查詢控制系統的所有事件日誌、追蹤預約執行流程、監控系統健康狀態。"
      />
      <LogsClient />
    </div>
  )
}
