import type * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DoorClosed, History, KeyRound, ListChecks, ShieldAlert } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { formatDateTime, now } from '@/lib/time'
import { cn } from '@/lib/utils'
import { DemoModeBanner, Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import {
  ACCESS_BUFFER_AFTER_MINUTES,
  ACCESS_BUFFER_BEFORE_MINUTES,
  PHASE_LABEL,
  grantPhase,
  listDoorAudit,
  listGrants,
  type GrantPhase,
} from '@/server/door-access-grants'
import { ManualGrantForm, RevokeButton } from './access-client'
import { DoorRemoteCard } from './door-remote-card'
import { PasswordSettings } from './password-settings'
import { SlotPasswordRecords, type SlotRecord, type SlotStats } from './slot-password-records'
import { SLOT_TYPE_LABEL, effectiveMode, expireOffsetMinutes, getOrCreateRule, openOffsetMinutes } from '@/server/slot-password-service'
import { AlwaysOpenToggle } from './always-open-toggle'
import { getDoorRemoteState } from '@/server/door-remote'
import { WatchdogClient } from './watchdog-client'

export const metadata: Metadata = { title: '門禁權限管理' }
export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'grants', label: '授權管理', icon: KeyRound },
  { key: 'devices', label: '門禁設備', icon: DoorClosed },
  { key: 'logs', label: '進出紀錄', icon: ListChecks },
  { key: 'alerts', label: '異常事件', icon: ShieldAlert },
  { key: 'audit', label: '管理者操作紀錄', icon: History },
] as const
type TabKey = (typeof TABS)[number]['key']

/** 門禁設備：尚未提供控制器資料，型號與通道一律待確認 */
const DOOR_DEVICES = [
  { name: '大門門禁', location: '出入口（建築右側）', controller: '待確認', unlockMethod: '待確認', power: '迴路 12「大門監控與門鎖供電」（24 小時供電）' },
]

const PHASE_TONE: Record<GrantPhase, 'green' | 'blue' | 'gray' | 'red'> = { ACTIVE: 'green', UPCOMING: 'blue', EXPIRED: 'gray', REVOKED: 'red' }

const AUDIT_LABEL: Record<string, string> = {
  DOOR_GRANT_AUTO_CREATE: '預約付款，自動建立授權',
  DOOR_GRANT_AUTO_UPDATE: '預約異動，自動更新授權期間',
  DOOR_GRANT_AUTO_REVOKE: '訂單取消／退款，自動撤銷授權',
  DOOR_GRANT_MANUAL_CREATE: '手動授權',
  DOOR_GRANT_REVOKE: '手動撤銷授權',
  DOOR_REMOTE_OPEN: '遠端開門',
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await pagePermission('access')
  if (ctx === 'forbidden') return <Forbidden />
  const canGrant = can(ctx.role, 'access.grant')
  const canRemote = can(ctx.role, 'access.remote')
  const { tab: rawTab } = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'grants'

  return (
    <div className="space-y-5">
      <PageTitle title="門禁權限管理" desc="誰、在什麼時間可以進入球館。與一般設備電源控制分開管理。" />
      <DemoModeBanner what="門禁控制器" />

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-zinc-200" aria-label="門禁分頁">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/admin/access?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === key ? 'bg-[#1f4d34] text-white' : 'text-zinc-600 hover:bg-zinc-100',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'grants' && <GrantsTab canGrant={canGrant} canRemote={canRemote} />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'logs' && (
        <Empty title="尚無進出紀錄" desc="進出紀錄由門禁控制器回報。目前尚未串接門禁控制器，因此沒有任何紀錄；串接後會在這裡顯示每次刷卡、密碼或開門的時間與結果。" />
      )}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{desc}</p>
    </div>
  )
}

const MODE_TEXT: Record<string, string> = { SPLIT_DAY: '上午一組、下午一組', DAILY: '每天一組', HOURLY: '每小時一組', PER_ORDER: '每筆預訂單獨立' }

type SlotPageData =
  | { ready: false }
  | { ready: true; settings: React.ComponentProps<typeof PasswordSettings>['settings']; stats: SlotStats; records: SlotRecord[] }

/** 預約密碼設定與「密碼時段記錄」的資料（只顯示遮罩密碼）。資料表尚未建立時回傳 ready=false，頁面其他區塊照常顯示 */
async function loadSlotPasswordData(venue: { id: string; bookAheadDays: number; passwordBookAheadDaysOverride: number | null }, at: Date): Promise<SlotPageData> {
  try {
    const rule = await getOrCreateRule(venue.id)
    const [futureSlots, logCounts, slots] = await Promise.all([
      prisma.slotPassword.count({ where: { venueId: venue.id, expireAt: { gt: at }, status: { in: ['SCHEDULED', 'ACTIVE'] } } }),
      prisma.slotPasswordLog.groupBy({ by: ['sendStatus'], where: { slotPassword: { venueId: venue.id } }, _count: { _all: true } }),
      prisma.slotPassword.findMany({
        where: { venueId: venue.id, expireAt: { gt: new Date(at.getTime() - 86_400_000) } },
        orderBy: { slotStartAt: 'asc' },
        take: 60,
        include: {
          bookingSlots: { include: { booking: { select: { id: true, code: true, status: true, user: { select: { displayName: true } } } } } },
          passwordLogs: true,
        },
      }),
    ])
    const sendCount = (k: string) => logCounts.find((c) => c.sendStatus === k)?._count._all ?? 0
    const open = openOffsetMinutes(rule)
    const expire = expireOffsetMinutes(rule)
    const mode = effectiveMode(rule)
    const stats: SlotStats = {
      modeLabel: MODE_TEXT[mode] ?? rule.generationMode,
      openLabel: `預約開始前 ${open} 分鐘`,
      expireLabel: expire === 0 ? '預約結束立即失效' : `預約結束後 ${expire} 分鐘`,
      generateAheadDays: rule.generateAheadDays,
      bookAheadDays: venue.passwordBookAheadDaysOverride ?? venue.bookAheadDays,
      shared: mode !== 'PER_ORDER',
      futureSlots,
      lineSent: sendCount('SENT'),
      lineFailed: sendCount('FAILED'),
    }
    const records: SlotRecord[] = slots.map((s) => ({
      id: s.id,
      date: s.slotDate,
      slotLabel: SLOT_TYPE_LABEL(s.slotType),
      maskedCode: s.maskedCode,
      openAt: formatDateTime(s.openAt),
      expireAt: formatDateTime(s.expireAt),
      activeOrderCount: s.activeOrderCount,
      status: s.status,
      bookings: s.bookingSlots.map((l) => {
        const log = s.passwordLogs.find((x) => x.bookingId === l.bookingId)
        return {
          bookingId: l.bookingId,
          code: l.booking.code,
          holder: l.booking.user.displayName,
          valid: l.booking.status === 'PAID' || l.booking.status === 'COMPLETED',
          sendStatus: log?.sendStatus ?? null,
          failureReason: log?.failureReason ?? null,
          retryCount: log?.retryCount ?? 0,
          sentAt: log?.sentAt ? formatDateTime(log.sentAt) : null,
        }
      }),
    }))
    return {
      ready: true,
      settings: {
        generationMode: rule.generationMode,
        generateAheadDays: rule.generateAheadDays,
        passwordOpenTime: rule.passwordOpenTime,
        passwordOpenCustomMinutes: rule.passwordOpenCustomMinutes,
        passwordExpireTime: rule.passwordExpireTime === 'CUSTOM' ? '30_MIN_AFTER' : rule.passwordExpireTime,
        lockWhenNoOrders: rule.lockWhenNoOrders,
        allowSharedPassword: rule.allowSharedPassword,
        passwordBookAheadDaysOverride: venue.passwordBookAheadDaysOverride,
      },
      stats,
      records,
    }
  } catch (err) {
    console.error('[access] 讀取時段密碼資料失敗（可能尚未套用資料表）', err)
    return { ready: false }
  }
}

async function GrantsTab({ canGrant, canRemote }: { canGrant: boolean; canRemote: boolean }) {
  const at = now()
  const [doorState, grants, members, venue] = await Promise.all([
    getDoorRemoteState(),
    listGrants(),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: 500, select: { id: true, displayName: true, phone: true } }),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, bookAheadDays: true, passwordBookAheadDaysOverride: true } }),
  ])
  const bookingIds = grants.map((g) => g.bookingId).filter((x): x is string => Boolean(x))
  const codes = new Map((await prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, code: true } })).map((b) => [b.id, b.code]))
  const counts = grants.reduce<Record<GrantPhase, number>>((acc, g) => ((acc[grantPhase(g, at)] += 1), acc), { ACTIVE: 0, UPCOMING: 0, EXPIRED: 0, REVOKED: 0 })
  const slotData = venue && canGrant ? await loadSlotPasswordData(venue, at) : null

  return (
    <div className="space-y-5">
      {/* 大門即時控制 - 行動優先 */}
      <DoorRemoteCard state={doorState} canRemote={canRemote} />

      {/* 常開模式 */}
      <AlwaysOpenToggle
        isOpen={doorState.alwaysOpen}
        canControl={canRemote}
      />

      {/* 預約密碼設定 */}
      {slotData && !slotData.ready && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">預約密碼設定</h2>
          <p className="mt-1 text-xs">此資料庫尚未建立時段密碼資料表（prisma/migrations-manual/2026-11-17b_slot_passwords.sql），套用後即可設定與查看密碼時段。</p>
        </section>
      )}
      {venue && slotData?.ready && (
        <>
          <PasswordSettings settings={slotData.settings} defaultBookAheadDays={venue.bookAheadDays} />
          <SlotPasswordRecords stats={slotData.stats} records={slotData.records} />
        </>
      )}

      {/* 手動授權 */}
      {canGrant && (
        <ManualGrantForm members={members.map((m) => ({ id: m.id, label: `${m.displayName}${m.phone ? `（${m.phone.slice(0, 4)}***${m.phone.slice(-3)}）` : ''}` }))} />
      )}

      {/* 授權列表 */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <h2 className="mr-auto text-sm font-semibold">授權列表</h2>
          {(['ACTIVE', 'UPCOMING', 'EXPIRED', 'REVOKED'] as GrantPhase[]).map((p) => (
            <Pill key={p} tone={PHASE_TONE[p]}>
              {PHASE_LABEL[p]} {counts[p]}
            </Pill>
          ))}
        </div>
        {grants.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">目前沒有任何門禁授權。</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {grants.map((g) => {
              const phase = grantPhase(g, at)
              return (
                <li key={g.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.holderName}</p>
                    <p className="text-[11px] text-muted">
                      {g.source === 'BOOKING' ? `預約授權・訂單 ${g.bookingId ? (codes.get(g.bookingId) ?? '—') : '—'}` : `手動授權・${g.userId ? '會員' : '非會員'}`}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-700">
                    {formatDateTime(g.validFrom)} → {formatDateTime(g.validUntil)}
                  </p>
                  <div className="text-xs">
                    <Pill tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Pill>
                    {phase === 'REVOKED' && (
                      <p className="mt-1 text-[11px] text-muted">
                        {g.revokedBy === 'system' ? '系統' : g.revokedBy}：{g.revokeReason}
                      </p>
                    )}
                    {g.note && <p className="mt-1 text-[11px] text-muted">備註：{g.note}</p>}
                  </div>
                  <div className="md:justify-self-end">{canGrant && (phase === 'ACTIVE' || phase === 'UPCOMING') && <RevokeButton id={g.id} name={g.holderName} />}</div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function DevicesTab() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">門禁設備列表</h2>
      <ul className="divide-y divide-zinc-100">
        {DOOR_DEVICES.map((d) => (
          <li key={d.name} className="grid gap-x-6 gap-y-2 px-4 py-4 text-sm sm:grid-cols-2">
            <p className="font-semibold sm:col-span-2">{d.name}</p>
            <p>
              <span className="text-muted">位置：</span>
              {d.location}
            </p>
            <p>
              <span className="text-muted">連線狀態：</span>
              <span className="font-medium text-amber-700">未連線（Demo Mode）</span>
            </p>
            <p>
              <span className="text-muted">控制器型號／通道：</span>
              <span className="text-amber-700">{d.controller}</span>
            </p>
            <p>
              <span className="text-muted">開門方式：</span>
              <span className="text-amber-700">{d.unlockMethod}</span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-muted">供電：</span>
              {d.power}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-zinc-100 px-4 py-3 text-xs text-muted">門禁設備只負責「誰可以進入」，與智慧設備管理的電源開關分開；這裡沒有遠端開門功能，串接硬體後才會開放並另外檢查權限。</p>
    </section>
  )
}

async function AlertsTab() {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
  if (!venue) return <Empty title="無法載入" desc="找不到活動的場館。" />
  return <WatchdogClient venueId={venue.id} />
}

async function AuditTab() {
  const rows = await listDoorAudit()
  if (rows.length === 0) return <Empty title="尚無操作紀錄" desc="建立、更新或撤銷門禁授權與遠端開門時，系統與管理者的每一次操作都會記錄在這裡。" />
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">管理者操作紀錄（最近 100 筆）</h2>
      <ul className="divide-y divide-zinc-100">
        {rows.map((r) => {
          const d = (r.detail ?? {}) as Record<string, unknown>
          return (
            <li key={r.id} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[7rem_8rem_minmax(0,1fr)]">
              <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
              <span className="text-xs font-medium">{r.actor === 'system' ? '系統' : r.actor}</span>
              <span className="min-w-0">
                {AUDIT_LABEL[r.action] ?? r.action}・{r.target}
                {typeof d.reason === 'string' && <span className="text-muted">（{d.reason}）</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
