'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, CreditCard, Database, Megaphone, Pencil, Plug, Save, ScrollText, Server, ShieldAlert, Tag, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { ErrorState, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { getAuditLogs, getCourts, getPricing, getSettings, updateVenueSettings } from '@/lib/api-service'
import type { AuditEntry, Court, MembershipTierRow, PriceRuleRow, SystemSettings, VenueSettings, VenueSettingsPatch } from '@/lib/models'

/**
 * 設定（Phase 2）。
 * 場館資料、營運規則、公告與政策讀寫資料庫 Venue；
 * 金流與整合只顯示是否已設定；稽核紀錄讀 AuditLog。
 */

type Section = 'info' | 'rules' | 'notice'

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
      rules: ['openMinute', 'closeMinute', 'bookAheadDays', 'holdMinutes', 'bookingCutoffMinutes'],
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

  const step = venue?.slotMinutes ?? 60
  const timeOptions = (from: number, to: number) => {
    const out: number[] = []
    for (let m = from; m <= to; m += step) out.push(m)
    return out
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="設定"
        subtitle="場館資料、營運規則、金流與系統狀態"
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
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 場館資料 */}
          <Card icon={Building2} title="場館資料" aside={editActions('info')}>
            {editing === 'info' ? (
              <div className="space-y-3 p-4">
                <Field label="場館名稱" htmlFor="v-name" required>
                  <Input id="v-name" value={draft.name ?? ''} maxLength={60} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="地址" htmlFor="v-address">
                  <Input id="v-address" value={draft.address ?? ''} maxLength={200} onChange={(e) => set('address', e.target.value)} />
                </Field>
                <Field label="電話" htmlFor="v-phone">
                  <Input id="v-phone" value={draft.phone ?? ''} maxLength={40} onChange={(e) => set('phone', e.target.value)} />
                </Field>
                <Field label="簡介" htmlFor="v-desc">
                  <Textarea id="v-desc" rows={3} value={draft.description ?? ''} maxLength={2000} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            ) : (
              <KV
                rows={[
                  ['系統組織名稱', settings.organization?.name ?? '—'],
                  ['場館名稱', venue.name],
                  ['地址', venue.address || '—'],
                  ['電話', venue.phone || '—'],
                  ['簡介', venue.description || '—'],
                  ['時區', venue.timezone],
                ]}
              />
            )}
          </Card>

          {/* 營運規則 */}
          <Card icon={ScrollText} title="營運規則" aside={editActions('rules')}>
            {editing === 'rules' ? (
              <div className="grid grid-cols-2 gap-3 p-4">
                <Field label="營業開始" htmlFor="v-open">
                  <select
                    id="v-open"
                    value={draft.openMinute}
                    onChange={(e) => set('openMinute', Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
                  >
                    {timeOptions(0, 1440 - step).map((m) => (
                      <option key={m} value={m}>{fmtMinute(m)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="營業結束" htmlFor="v-close">
                  <select
                    id="v-close"
                    value={draft.closeMinute}
                    onChange={(e) => set('closeMinute', Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
                  >
                    {timeOptions((draft.openMinute ?? 0) + step, 1440).map((m) => (
                      <option key={m} value={m}>{fmtMinute(m)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="可預約未來天數" htmlFor="v-ahead" hint="1–90 天">
                  <Input id="v-ahead" type="number" min={1} max={90} value={draft.bookAheadDays ?? ''} onChange={(e) => set('bookAheadDays', Number(e.target.value))} />
                </Field>
                <Field label="購物車保留（分鐘）" htmlFor="v-hold" hint="3–60 分鐘">
                  <Input id="v-hold" type="number" min={3} max={60} value={draft.holdMinutes ?? ''} onChange={(e) => set('holdMinutes', Number(e.target.value))} />
                </Field>
                <Field label="預約截止（開打前分鐘）" htmlFor="v-cutoff" hint="0 = 可預約到開打前一刻；前台超過截止會顯示「已截止」">
                  <Input id="v-cutoff" type="number" min={0} max={1440} value={draft.bookingCutoffMinutes ?? ''} onChange={(e) => set('bookingCutoffMinutes', Number(e.target.value))} />
                </Field>
                <p className="col-span-2 text-xs text-muted">時段長度 {venue.slotMinutes} 分鐘不開放修改，避免打亂既有預約。縮短營業時間不會取消已成立的訂單。</p>
              </div>
            ) : (
              <KV
                rows={[
                  ['營業時間', `${fmtMinute(venue.openMinute)}–${fmtMinute(venue.closeMinute)}，每日`],
                  ['時段長度', `${venue.slotMinutes} 分鐘`],
                  ['可預約', `未來 ${venue.bookAheadDays} 天`],
                  ['購物車保留', `${venue.holdMinutes} 分鐘`],
                  ['預約截止', venue.bookingCutoffMinutes > 0 ? `開打前 ${venue.bookingCutoffMinutes} 分鐘` : '可預約到開打前一刻'],
                  ['付款期限', `建立訂單後 ${settings.rules.paymentWindowMinutes} 分鐘`],
                ]}
              />
            )}
          </Card>

          {/* 公告與政策 */}
          <Card icon={Megaphone} title="公告與取消政策" subtitle="顯示於前台預約頁與訂單詳情" aside={editActions('notice')}>
            {editing === 'notice' ? (
              <div className="space-y-3 p-4">
                <Field label="公告" htmlFor="v-notice" hint="留空則不顯示">
                  <Textarea id="v-notice" rows={3} value={draft.notice ?? ''} maxLength={2000} onChange={(e) => set('notice', e.target.value)} />
                </Field>
                <Field label="取消政策說明" htmlFor="v-policy" hint="文字說明；實際退款比例依下方級距計算">
                  <Textarea id="v-policy" rows={4} value={draft.policy ?? ''} maxLength={2000} onChange={(e) => set('policy', e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className="space-y-3 p-4 text-sm">
                <div>
                  <p className="text-xs text-muted">公告</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{venue.notice || '（未設定）'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">取消政策說明</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{venue.policy || '（未設定）'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">退款級距（系統計算用）</p>
                  <ul className="mt-1 divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                    {settings.rules.refundPolicy.map((r) => (
                      <li key={r.window} className="flex justify-between px-3 py-1.5 text-xs">
                        <span>{r.window}</span>
                        <span className="font-medium">{r.ratio}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* 球場資訊 */}
          <Card icon={ClipboardList} title="球場資訊" subtitle={`${courts.length} 面`} aside={<a href="/admin/courts" className="text-xs text-brand-600 hover:underline">管理 →</a>}>
            <ul className="divide-y divide-[rgb(var(--border))] text-sm">
              {courts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <span>
                    {c.name}
                    <span className="ml-2 text-xs text-muted">容納 {c.capacity} 人</span>
                  </span>
                  <StatusBadge status={c.status === 'ACTIVE' ? '營運中' : c.status === 'MAINTENANCE' ? '維護中' : '停用'} variant={c.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" />
                </li>
              ))}
            </ul>
          </Card>

          {/* 定價摘要 */}
          <Card icon={Tag} title="定價摘要" aside={<a href="/admin/pricing" className="text-xs text-brand-600 hover:underline">管理 →</a>}>
            <KV
              rows={[
                ...rules.map((r) => [`${r.dayType === 'WEEKEND' ? '假日' : r.dayType === 'WEEKDAY' ? '平日' : '每天'}${r.name}`, `${fmtMinute(r.startMinute)}–${fmtMinute(r.endMinute)}　NT$${r.price.toLocaleString()}`] as [string, string]),
                ['會員折扣', tiers.map((t) => `${t.label} ${t.discountPct}%`).join('／') || '—'],
              ]}
            />
          </Card>

          {/* 金流設定 */}
          <Card icon={CreditCard} title="金流設定" subtitle="由 Vercel 環境變數設定，此處唯讀">
            <KV rows={[['目前金流', settings.payment.providerLabel]]} />
            <StatusList items={settings.payment.providers} />
          </Card>

          {/* 整合狀態 */}
          <Card icon={Plug} title="外部整合">
            <StatusList items={settings.integrations} />
          </Card>

          {/* 系統資訊 */}
          <Card icon={Server} title="系統資訊">
            <KV
              rows={[
                ['執行環境', settings.system.environment + (settings.system.region ? `（${settings.system.region}）` : '')],
                ['資料庫', settings.system.database],
                ['後台資料來源', settings.system.adminSource === 'live' ? '資料庫（live）' : '示範資料（mock）'],
              ]}
            />
            <ul className="divide-y divide-[rgb(var(--border))] border-t border-[rgb(var(--border))] text-sm">
              {API_STATUS.map((a) => (
                <li key={a.name} className="flex items-center justify-between px-4 py-2">
                  <span>{a.name}</span>
                  <StatusBadge status={a.mode === 'live' ? '已連線' : 'mock'} variant={a.mode === 'live' ? 'success' : 'warning'} size="sm" />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* 稽核紀錄 */}
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
