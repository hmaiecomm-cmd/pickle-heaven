'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, CreditCard, Database, Megaphone, Pencil, Plug, Save, ScrollText, Server, ShieldAlert, Tag, XCircle, Users, Bell, Settings2, Globe, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { ErrorState, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { getAuditLogs, getCourts, getPricing, getSettings, updateVenueSettings } from '@/lib/api-service'
import type { AuditEntry, Court, MembershipTierRow, PriceRuleRow, SystemSettings, VenueSettings, VenueSettingsPatch } from '@/lib/models'

/**
 * 設定（Phase 3）：無人化營運中心。
 * 場館資料、營運規則、公告與政策讀寫資料庫 Venue；
 * 金流與整合只顯示是否已設定；稽核紀錄讀 AuditLog。
 * 新增：仪表板风格的四区块设计，以图示与状态优先。
 */

type Section = 'info' | 'notice'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtMinute = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const fmtDateTime = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

const API_STATUS: { name: string; mode: 'live' | 'mock' }[] = [
  { name: '場地預約、訂單、付款（Turso）', mode: 'live' },
  { name: '球敘與範本（Turso）', mode: 'live' },
  { name: '營收與財務（Turso）', mode: 'live' },
  { name: '球場與裝置清單（Turso）', mode: 'live' },
  { name: '費用、收據、發票（Turso）', mode: 'live' },
  { name: '會員與定價（Turso）', mode: 'live' },
  { name: '場館設定與稽核紀錄（Turso）', mode: 'live' },
  { name: 'OCR 辨識（模擬）', mode: 'mock' },
  { name: '活動（球敘）與教練（Turso）', mode: 'live' },
  { name: 'AI 管理助理（Claude）', mode: 'live' },
  { name: '智慧球場即時控制', mode: 'mock' },
]

const ACTION_LABEL: Record<string, string> = {
  BOOKING_CANCELLED: '取消訂單',
  BOOKING_COMPLETED: '標記訂單完成',
  SLOT_BLOCKED: '鎖定時段',
  SLOT_UNBLOCKED: '解除時段鎖定',
  COURT_STATUS: '變更球場狀態',
  EXPENSE_CREATE: '登錄費用',
  EXPENSE_STATUS: '費用審核',
  INVOICE_STATUS: '變更發票狀態',
  RECEIPT_OCR_DRAFT: '建立 OCR 收據草稿',
  RECEIPT_OCR_CONFIRM: '確認 OCR 收據',
  MEMBER_LEVEL: '調整會員等級',
  PRICING_TIERS: '更新會員折扣',
  VENUE_UPDATE: '更新場館設定',
  AI_ACTION_CONFIRMED: '確認 AI 操作預覽（未執行）',
  AI_ACTION_DECLINED: '取消 AI 操作預覽',
  COACH_CREATE: '新增教練',
  SESSION_CREATE: '新增單次球敘',
  COACH_UPDATE: '修改教練',
}

const CODE_LABEL: Record<string, string> = {
  ACTIVE: '營運中', MAINTENANCE: '維護中', INACTIVE: '停用',
  DRAFT: '草稿', SUBMITTED: '待審核', APPROVED: '已核准', REJECTED: '已退回',
  ISSUED: '已開立', PAID: '已付款', OVERDUE: '逾期', CANCELLED: '已作廢',
  BASIC: '一般', PREMIUM: '進階', VIP: 'VIP',
}
const code = (v: unknown) => (typeof v === 'string' ? (CODE_LABEL[v] ?? v) : String(v))

/** 把稽核紀錄的 detail 轉成一行人看得懂的摘要。 */
function summarize(a: AuditEntry): string {
  const d = a.detail ?? {}
  const arrow = d.from !== undefined && d.to !== undefined && typeof d.from !== 'object' ? `　${code(d.from)} → ${code(d.to)}` : ''
  switch (a.action) {
    case 'COURT_STATUS':
    case 'MEMBER_LEVEL':
      return `${d.name ?? ''}${arrow}`
    case 'EXPENSE_STATUS':
      return `${d.expenseNumber ?? ''}${arrow}`
    case 'INVOICE_STATUS':
      return `${d.invoiceNumber ?? ''}${arrow}`
    case 'EXPENSE_CREATE':
      return `${d.expenseNumber ?? ''}　NT$${Number(d.amount ?? 0).toLocaleString()}　${code(d.status)}`
    case 'RECEIPT_OCR_DRAFT':
      return `${d.receiptNumber ?? ''}　${d.vendorName ?? ''}　NT$${Number(d.amount ?? 0).toLocaleString()}`
    case 'RECEIPT_OCR_CONFIRM':
      return String(d.receiptNumber ?? '')
    case 'PRICING_TIERS': {
      const from = (d.from ?? {}) as Record<string, number>
      const to = (d.to ?? {}) as Record<string, number>
      const diff = Object.keys(to).filter((k) => from[k] !== to[k]).map((k) => `${code(k)} ${from[k] ?? '—'}% → ${to[k]}%`)
      return diff.join('、') || '無變動'
    }
    case 'SESSION_CREATE':
      return `${d.title ?? ''}　${d.date ?? ''}　${d.capacity ?? ''} 人　NT$${Number(d.price ?? 0).toLocaleString()}`
    case 'COACH_CREATE':
      return `${d.name ?? ''}　NT$${Number(d.hourlyRate ?? 0).toLocaleString()}/時`
    case 'COACH_UPDATE':
      return `${d.name ?? ''}：${Array.isArray(d.fields) ? d.fields.join('、') : ''}${arrow}`
    case 'AI_ACTION_CONFIRMED':
    case 'AI_ACTION_DECLINED':
      return String(d.title ?? '')
    case 'VENUE_UPDATE':
      return `${d.name ?? ''}：${Array.isArray(d.fields) ? d.fields.join('、') : ''}`
    default:
      return a.target ?? ''
  }
}

export function SettingsClient() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [courts, setCourts] = useState<Court[]>([])
  const [rules, setRules] = useState<PriceRuleRow[]>([])
  const [tiers, setTiers] = useState<MembershipTierRow[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [auditDone, setAuditDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [venueIdx, setVenueIdx] = useState(0)
  const [editing, setEditing] = useState<Section | null>(null)
  const [draft, setDraft] = useState<VenueSettingsPatch>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, c, p, a] = await Promise.all([getSettings(), getCourts(), getPricing(), getAuditLogs({ limit: 20 })])
      if (!s.success) throw new Error(s.error?.message ?? '無法載入設定')
      setSettings(s.data)
      setCourts(c.success ? c.data : [])
      if (p.success) {
        setRules(p.data.priceRules)
        setTiers(p.data.tiers)
      }
      setAudit(a.success ? a.data : [])
      setAuditDone(!a.success || a.data.length < 20)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const loadMoreAudit = async () => {
    const last = audit[audit.length - 1]
    const res = await getAuditLogs({ limit: 20, before: last?.createdAt })
    if (!res.success) return toast('載入失敗', 'error')
    setAudit((list) => [...list, ...res.data])
    if (res.data.length < 20) setAuditDone(true)
  }

  if (loading) return <LoadingState />
  if (error || !settings) return <ErrorState description={error ?? '沒有資料'} retry={load} />

  const venue: VenueSettings | undefined = settings.venues[venueIdx]

  const startEdit = (section: Section) => {
    if (!venue) return
    const pick: Record<Section, (keyof VenueSettingsPatch)[]> = {
      info: ['name', 'address', 'phone', 'description'],
      notice: ['notice', 'policy'],
    }
    setDraft(Object.fromEntries(pick[section].map((k) => [k, venue[k]])) as VenueSettingsPatch)
    setEditing(section)
  }

  const save = async () => {
    if (!venue) return
    setSaving(true)
    try {
      const res = await updateVenueSettings(venue.id, draft)
      if (!res.success) {
        toast(`儲存失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setSettings((s) => (s ? { ...s, venues: s.venues.map((v, i) => (i === venueIdx ? { ...v, ...draft } : v)) } : s))
      setEditing(null)
      toast(res.data.changed.length ? '場館設定已更新，前台立即生效' : '沒有變更', res.data.changed.length ? 'success' : 'info')
      const a = await getAuditLogs({ limit: 20 })
      if (a.success) {
        setAudit(a.data)
        setAuditDone(a.data.length < 20)
      }
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof VenueSettingsPatch>(k: K, v: VenueSettingsPatch[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const editActions = (section: Section) =>
    editing === section ? (
      <div className="flex gap-2">
        <Button size="sm" loading={saving} onClick={save}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          儲存
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>取消</Button>
      </div>
    ) : (
      <Button size="sm" variant="ghost" disabled={editing !== null || !venue} onClick={() => startEdit(section)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        編輯
      </Button>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="系統設定"
        subtitle="場館、權限、整合與內容管理"
        action={
          settings.venues.length > 1 ? (
            <select
              aria-label="場館"
              value={venueIdx}
              disabled={editing !== null}
              onChange={(e) => setVenueIdx(Number(e.target.value))}
              className="h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm"
            >
              {settings.venues.map((v, i) => (
                <option key={v.id} value={i}>{v.name}</option>
              ))}
            </select>
          ) : undefined
        }
      />

      {settings.warnings.length > 0 && (
        <ul className="space-y-2" aria-label="安全提醒">
          {settings.warnings.map((w) => (
            <li
              key={w.message}
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                w.level === 'danger'
                  ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
              }`}
            >
              {w.level === 'danger' ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {!venue ? (
        <p className="rounded-lg border border-[rgb(var(--border))] p-6 text-center text-sm text-muted">尚未建立場館。</p>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* 🏢 一、場館與品牌設定 */}
          <section className="rounded-lg sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
            <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-green-100 p-2 sm:p-3">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-700" aria-hidden />
                </div>
                <h2 className="text-base sm:text-lg font-semibold">場館與品牌設定</h2>
              </div>
              <Button size="sm" variant="ghost" disabled={editing !== null || !venue} onClick={() => startEdit('info')}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                <span className="ml-1 hidden sm:inline">編輯</span>
              </Button>
            </div>

            {editing === 'info' ? (
              <div className="space-y-3">
                <Field label="場館名稱" htmlFor="v-name" required>
                  <Input id="v-name" value={draft.name ?? ''} maxLength={60} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="地址" htmlFor="v-address">
                  <Input id="v-address" value={draft.address ?? ''} maxLength={200} onChange={(e) => set('address', e.target.value)} />
                </Field>
                <Field label="電話" htmlFor="v-phone">
                  <Input id="v-phone" value={draft.phone ?? ''} maxLength={40} onChange={(e) => set('phone', e.target.value)} />
                </Field>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" loading={saving} onClick={save}>
                    <Save className="h-3.5 w-3.5" aria-hidden />
                    儲存
                  </Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>取消</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SettingTile label="場館名稱" value={venue.name} />
                <SettingTile label="地址" value={venue.address || '未設定'} />
                <SettingTile label="電話" value={venue.phone || '未設定'} />
                <SettingTile label="營業時間" value={`${fmtMinute(venue.openMinute)}–${fmtMinute(venue.closeMinute)}`} />
              </div>
            )}

            {!editing && (
              <div className="mt-4 sm:mt-6 border-t border-zinc-200 pt-4 sm:pt-4">
                <p className="text-xs sm:text-sm font-semibold text-zinc-500 mb-2 sm:mb-3">官網狀態</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SettingStatusLink href="/" label="首頁" status="已發布" />
                  <SettingStatusLink href="/admin/settings/site" label="頁面管理" status="尚未開放" tone="amber" />
                </div>
              </div>
            )}
          </section>

          {/* 👥 二、管理者與權限 */}
          <section className="rounded-lg sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
            <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-blue-100 p-2 sm:p-3">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-700" aria-hidden />
                </div>
                <h2 className="text-base sm:text-lg font-semibold">管理者與權限</h2>
              </div>
              <Link href="/admin/settings/staff" className="text-xs sm:text-sm font-semibold text-brand-600 hover:underline">管理 →</Link>
            </div>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <SettingTile label="員工帳號" value={`${audit.filter(a => a.action.includes('STAFF')).length}+`} hint="管理角色與授權" />
              <SettingTile label="操作紀錄" value={`最近 ${audit.length} 筆`} hint="已記錄所有修改" />
            </div>
          </section>

          {/* 🔌 三、通知與系統串接 */}
          <section className="rounded-lg sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
            <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-purple-100 p-2 sm:p-3">
                <Plug className="h-4 w-4 sm:h-5 sm:w-5 text-purple-700" aria-hidden />
              </div>
              <h2 className="text-base sm:text-lg font-semibold">通知與系統串接</h2>
            </div>
            <div className="grid gap-2 sm:gap-3">
              {settings.integrations.map((i) => (
                <IntegrationStatusRow key={i.key} label={i.label} configured={i.configured} href={i.key === 'payments' ? '/admin/settings/payments' : undefined} />
              ))}
              <IntegrationStatusRow label="金流" configured={settings.payment.providers.some(p => p.configured)} href="/admin/settings/payments" />
              <IntegrationStatusRow label="發票" configured={settings.payment.providers.length > 0} href="/admin/settings/payments" />
            </div>
          </section>

          {/* 🌐 四、官網與內容管理 */}
          <section className="rounded-lg sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
            <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-cyan-100 p-2 sm:p-3">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-700" aria-hidden />
              </div>
              <h2 className="text-base sm:text-lg font-semibold">官網與內容管理</h2>
            </div>
            <div className="grid gap-2 sm:gap-3">
              <ContentLink href="/" label="首頁" icon="🏠" status="已發布" />
              <ContentLink href="/admin/settings/site" label="場館介紹" icon="ℹ️" status="尚未開放" tone="amber" />
              <ContentLink href="/admin/settings/site" label="活動與課程" icon="📅" status="尚未開放" tone="amber" />
              <ContentLink href="/admin/settings/site" label="常見問題" icon="❓" status="尚未開放" tone="amber" />
              <ContentLink href="/admin/settings/site" label="聯繫我們" icon="📧" status="已設定" />
            </div>
          </section>
        </div>
      )}

      {/* 📊 稽核紀錄 - 保留在下方 */}
      <Card icon={Database} title="稽核紀錄" subtitle="後台所有寫入操作">
        {audit.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">尚無紀錄</p>
        ) : (
          <>
            <ul className="divide-y divide-[rgb(var(--border))] text-sm">
              {audit.map((a) => (
                <li key={a.id} className="grid grid-cols-[8.5rem_5rem_1fr] items-start gap-3 px-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-0.5">
                  <span className="text-xs tabular-nums text-muted">{fmtDateTime(a.createdAt)}</span>
                  <span className="truncate text-xs font-medium">{a.actor}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                    {summarize(a) && <span className="ml-2 text-muted">{summarize(a)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {!auditDone && (
              <div className="border-t border-[rgb(var(--border))] p-3 text-center">
                <Button size="sm" variant="ghost" onClick={loadMoreAudit}>載入更多</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function Card({ icon: Icon, title, subtitle, aside, children }: { icon: React.ElementType; title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <span className="truncate text-xs text-muted">{subtitle}</span>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-[rgb(var(--border))] text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="whitespace-pre-wrap text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatusList({ items }: { items: { key: string; label: string; configured: boolean }[] }) {
  return (
    <ul className="divide-y divide-[rgb(var(--border))] border-t border-[rgb(var(--border))] text-sm">
      {items.map((i) => (
        <li key={i.key} className="flex items-center justify-between px-4 py-2">
          <span>{i.label}</span>
          <span className={`flex items-center gap-1 text-xs ${i.configured ? 'text-green-700 dark:text-green-400' : 'text-muted'}`}>
            {i.configured ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
            {i.configured ? '已設定' : '未設定'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 設定瓷磚：顯示標籤和值（響應式） */
function SettingTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
      <p className="text-xs sm:text-sm font-semibold text-zinc-500 mb-1">{label}</p>
      <p className="text-sm sm:text-base font-medium text-[rgb(var(--fg))] truncate">{value}</p>
      {hint && <p className="text-xs text-zinc-500 mt-1 sm:mt-2">{hint}</p>}
    </div>
  )
}

/** 設定狀態連結：帶狀態指示器（響應式） */
function SettingStatusLink({ href, label, status, tone = 'green' }: { href: string; label: string; status: string; tone?: 'green' | 'amber' | 'red' }) {
  const statusColor = tone === 'green' ? 'bg-green-100 text-green-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <Link href={href} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2 sm:p-3 hover:bg-zinc-50 group transition-colors">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-[rgb(var(--fg))]">{label}</p>
        <p className={`text-xs ${statusColor} rounded px-1.5 py-0.5 inline-block mt-1`}>{status}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 shrink-0 flex-shrink-0 ml-1" aria-hidden />
    </Link>
  )
}

/** 整合狀態列（響應式） */
function IntegrationStatusRow({ label, configured, href }: { label: string; configured: boolean; href?: string }) {
  const content = (
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
      <span className={`flex items-center gap-1 sm:gap-1.5 text-xs sm:text-xs font-semibold whitespace-nowrap ${configured ? 'text-green-700' : 'text-amber-700'}`}>
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${configured ? 'bg-green-500' : 'bg-amber-500'}`} aria-hidden />
        <span className="hidden sm:inline">{configured ? '已連接' : '需要設定'}</span>
        <span className="sm:hidden">{configured ? '✓' : '!'}</span>
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2 sm:p-3 hover:bg-zinc-50 transition-colors group">
        {content}
        <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 shrink-0 flex-shrink-0 ml-1 hidden sm:block" aria-hidden />
      </Link>
    )
  }

  return <div className="rounded-lg border border-zinc-200 bg-white p-2 sm:p-3">{content}</div>
}

/** 內容連結（響應式） */
function ContentLink({ href, label, icon, status, tone = 'green' }: { href: string; label: string; icon: string; status: string; tone?: 'green' | 'amber' | 'red' }) {
  const statusColor = tone === 'green' ? 'bg-green-100 text-green-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <Link href={href} className="flex items-center gap-2 sm:gap-3 rounded-lg border border-zinc-200 bg-white p-2 sm:p-3 hover:bg-zinc-50 group transition-colors">
      <span className="text-lg sm:text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-[rgb(var(--fg))] truncate">{label}</p>
        <p className={`text-xs ${statusColor} rounded px-1.5 py-0.5 inline-block mt-1`}>{status}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 shrink-0 flex-shrink-0 ml-1 hidden sm:block" aria-hidden />
    </Link>
  )
}
