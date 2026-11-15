import type { Metadata } from 'next'
import Link from 'next/link'
import { Construction } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { DemoModeBanner, Forbidden, PageTitle } from '@/components/admin/page-bits'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { CIRCUIT_NUMBERS } from '@/lib/venue-layout'
import { SchedulePicker } from './schedule-picker'

/** 可排程控制的迴路（24 小時供電與預留迴路不列入） */
const SCHEDULABLE = CIRCUIT_NUMBERS.filter((n) => CIRCUIT_DEFINITIONS[n].scheduleControlEnabled).sort()

export const metadata: Metadata = { title: '自動化策略' }
export const dynamic = 'force-dynamic'

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ circuit?: string }> }) {
  if ((await pagePermission('device')) === 'forbidden') return <Forbidden />
  const { circuit } = await searchParams
  const initial = (SCHEDULABLE as string[]).includes(circuit ?? '') ? (circuit as CircuitNumber) : SCHEDULABLE[0]

  return (
    <div className="space-y-5">
      <PageTitle title="自動化策略" desc="各迴路的控制時間排程與自動化規則。設備配置請到「設備總覽」，手動操作請到「控制中心」。" />
      <DemoModeBanner what="電力與設備硬體" />

      <section aria-labelledby="schedule-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="schedule-title" className="text-sm font-semibold">控制時間排程</h2>
          <p className="text-xs text-amber-700">排程儲存功能維修中，目前僅供檢視。</p>
        </div>
        <SchedulePicker initial={initial} />
        <p className="text-xs text-muted">24 小時供電（12–16）與預留迴路（17–18）不接受排程控制，因此不在清單中。</p>
      </section>

      <section aria-labelledby="rules-title" className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
        <h2 id="rules-title" className="flex items-center gap-2 text-sm font-semibold">
          <Construction className="h-4 w-4 text-amber-600" aria-hidden />
          自動化規則（尚未開放）
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          預約前開燈、結束後延遲關燈、設備離線通知等規則，必須在真實設備支援下才能啟用。目前尚未串接設備閘道，因此不提供可啟用的規則，以免畫面顯示已啟用但現場沒有動作。
        </p>
        <p className="mt-3 text-sm font-semibold">開放前需要</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>串接燈控、門禁等設備閘道，並能回報指令執行結果</li>
          <li>感測器或其他現場狀態來源（關燈前需確認現場無人）</li>
          <li>每條規則的執行條件、作用場地、例外日期、暫停功能與操作紀錄</li>
          <li>關燈與結束使用前檢查後續預約與延長使用；不影響緊急逃生</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/settings/devices" className="font-semibold text-brand-700 hover:underline">設備串接狀態 →</Link>
          <Link href="/admin/control" className="font-semibold text-brand-700 hover:underline">控制中心 →</Link>
        </div>
      </section>
    </div>
  )
}
