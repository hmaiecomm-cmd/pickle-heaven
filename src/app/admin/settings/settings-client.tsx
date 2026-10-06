'use client'

import { useEffect, useState } from 'react'
import { Building2, ClipboardList, CreditCard, Database, Pencil, ScrollText, Server, Tag } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { getCourts } from '@/lib/api-service'
import type { Court } from '@/lib/models'

/**
 * 設定（Phase 1I）。
 * 場館資料、營運規則、金流設定目前為頁內常數，Phase 2 改讀寫資料庫；
 * 球場資訊來自 mock api-service。
 */

const BUSINESS = [
  ['場館名稱', 'Pickleball Paradise - 台北'],
  ['營業人', '匹克精靈股份有限公司'],
  ['統一編號', '12345678'],
  ['地址', '台北市中山區北安路 000 號'],
  ['電話', '02-1234-5678'],
  ['Email', 'hello@pickleheaven.tw'],
  ['時區', 'Asia/Taipei'],
]
const PRICING = [
  ['離峰倍率', '×1.0（平日 09:00–17:00）'],
  ['尖峰倍率', '×1.3（平日 17:00–22:00）'],
  ['假日倍率', '×1.5'],
  ['會員折扣', '一般 0%／進階 10%／VIP 20%'],
]
const PAYMENT = [
  ['金流商', 'mock（開發用）'],
  ['可用方式', '信用卡、LINE Pay、銀行轉帳'],
  ['付款期限', '建立訂單後 15 分鐘'],
  ['退款政策', '開打前 24 小時可全額退款'],
]
const RULES = [
  ['營業時間', '09:00–22:00，每日'],
  ['時段長度', '60 分鐘'],
  ['最早可預約', '14 天前'],
  ['最晚可預約', '開打前 1 小時'],
  ['取消期限', '開打前 24 小時'],
  ['每筆上限', '同一會員每日最多 2 個時段'],
]
const API_STATUS: { name: string; mode: 'mock' | 'live' }[] = [
  { name: '預約與訂單', mode: 'mock' },
  { name: '會員與定價（Turso）', mode: 'live' },
  { name: '營收與付款（Turso）', mode: 'live' },
  { name: '費用、收據、發票（Turso）', mode: 'live' },
  { name: 'OCR 辨識', mode: 'mock' },
  { name: 'AI 助理', mode: 'mock' },
  { name: '球場與裝置清單（Turso）', mode: 'live' },
  { name: '智慧球場即時控制', mode: 'mock' },
  { name: '球敘與範本（Turso）', mode: 'live' },
  { name: '場地時段與訂單管理（Turso）', mode: 'live' },
]
const AUDIT = [
  { at: '今天 09:12', who: 'halfmoon', what: '核准費用 EXP-2024-001（NT$5,000）' },
  { at: '今天 08:40', who: '系統', what: '排程產生 9 場球敘（範本：大興店固定球敘）' },
  { at: '昨天 18:25', who: 'halfmoon', what: '將 Court 4 設為維護中' },
  { at: '昨天 14:02', who: '系統', what: '訂單 PH002 付款逾時提醒已發送' },
  { at: '2 天前', who: 'halfmoon', what: '更新尖峰倍率 1.2 → 1.3' },
]

export function SettingsClient() {
  const [courts, setCourts] = useState<Court[]>([])

  useEffect(() => {
    getCourts().then((r) => r.success && setCourts(r.data))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="設定"
        subtitle="場館資料、營運規則、金流與系統狀態"
        action={
          <span className="flex items-center gap-2">
            <StatusBadge status="SYSTEM_MODE=MOCK" variant="warning" />
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Building2} title="場館資料">
          <KV rows={BUSINESS} />
        </Section>

        <Section icon={ClipboardList} title="球場資訊" subtitle={`${courts.length} 面`}>
          <ul className="divide-y divide-[rgb(var(--border))] text-sm">
            {courts.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span>
                  {c.name}
                  <span className="ml-2 text-xs text-muted">容納 {c.capacity} 人</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">NT${c.pricePerHour.toLocaleString()}/h</span>
                  <StatusBadge status={c.status === 'ACTIVE' ? '營運中' : c.status === 'MAINTENANCE' ? '維護中' : '停用'} variant={c.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Tag} title="定價規則">
          <KV rows={PRICING} />
        </Section>

        <Section icon={CreditCard} title="金流設定">
          <KV rows={PAYMENT} />
        </Section>

        <Section icon={ScrollText} title="營運規則">
          <KV rows={RULES} />
        </Section>

        <Section icon={Server} title="API 連線狀態" subtitle="標示 mock 的功能尚未接真實服務" editable={false}>
          <ul className="divide-y divide-[rgb(var(--border))] text-sm">
            {API_STATUS.map((a) => (
              <li key={a.name} className="flex items-center justify-between px-4 py-2.5">
                <span>{a.name}</span>
                <StatusBadge status={a.mode === 'live' ? '已連線' : 'mock'} variant={a.mode === 'live' ? 'success' : 'warning'} size="sm" />
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section icon={Database} title="稽核紀錄" subtitle="最近 5 筆（mock）" editable={false}>
        <ul className="divide-y divide-[rgb(var(--border))] text-sm">
          {AUDIT.map((a, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted">{a.at}</span>
              <span className="w-16 shrink-0 text-xs font-medium">{a.who}</span>
              <span className="min-w-0 flex-1">{a.what}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-xs text-muted">所有設定目前唯讀。Phase 2 會改為可編輯並寫入資料庫，稽核紀錄改讀 AuditLog 資料表。</p>
    </div>
  )
}

function Section({ icon: Icon, title, subtitle, editable = true, children }: { icon: React.ElementType; title: string; subtitle?: string; editable?: boolean; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted" aria-hidden />
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </div>
        {editable && (
          <Button size="sm" variant="ghost" disabled title="Phase 2 實作">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            編輯
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function KV({ rows }: { rows: string[][] }) {
  return (
    <dl className="divide-y divide-[rgb(var(--border))] text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
