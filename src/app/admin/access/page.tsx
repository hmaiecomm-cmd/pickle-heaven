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
  listDoorAudit,
} from '@/server/door-access-grants'
import { ManualGrantForm } from './access-client'
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
  { key: 'devices', label: '密碼控制', icon: DoorClosed },
  { key: 'logs', label: '進出紀錄', icon: ListChecks },
  { key: 'alerts', label: '異常事件', icon: ShieldAlert },
  { key: 'audit', label: '開門與授權紀錄', icon: History },
] as const
type TabKey = (typeof TABS)[number]['key']

/** 門禁設備：尚未提供控制器資料，型號與通道一律待確認 */
const DOOR_DEVICES = [
  { name: '大門門禁', location: '出入口（建築右側）', controller: '待確認', unlockMethod: '待確認', power: '迴路 12「大門監控與門鎖供電」（24 小時供電）' },
]

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
  const isSuperAdmin = ctx.role === 'SUPER_ADMIN'
  const { tab: rawTab } = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'grants'

  // 預先加載場館與密碼設定資料
  const at = now()
  const [doorState, members, venue] = await Promise.all([
    getDoorRemoteState(),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: 500, select: { id: true, displayName: true, phone: true } }),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, bookAheadDays: true, passwordBookAheadDaysOverride: true } }),
  ])
  const slotData = venue && canGrant ? await loadSlotPasswordData(venue, at) : null

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

      {tab === 'grants' && <GrantsTab canGrant={canGrant} canRemote={canRemote} doorState={doorState} members={members} />}
      {tab === 'devices' && <PasswordControlTab venue={venue} slotData={slotData} isSuperAdmin={isSuperAdmin} />}
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
        passwordLength: rule.passwordLength,
        generateAheadDays: rule.generateAheadDays,
        passwordOpenTime: rule.passwordOpenTime,
        passwordOpenCustomMinutes: rule.passwordOpenCustomMinutes,
        passwordExpireTime: rule.passwordExpireTime === 'CUSTOM' ? '30_MIN_AFTER' : rule.passwordExpireTime,
        lockWhenNoOrders: rule.lockWhenNoOrders,
        allowSharedPassword: rule.allowSharedPassword,
        passwordBookAheadDaysOverride: venue.passwordBookAheadDaysOverride,
        basicMemberBookAheadDays: rule.basicMemberBookAheadDays,
        pointsMemberBookAheadDays: rule.pointsMemberBookAheadDays,
        vipMemberBookAheadDays: rule.vipMemberBookAheadDays,
      },
      stats,
      records,
    }
  } catch (err) {
    console.error('[access] 讀取時段密碼資料失敗（可能尚未套用資料表）', err)
    return { ready: false }
  }
}

async function GrantsTab({ canGrant, canRemote, doorState, members }: { canGrant: boolean; canRemote: boolean; doorState: Awaited<ReturnType<typeof getDoorRemoteState>>; members: { id: string; displayName: string; phone: string | null }[] }) {
  return (
    <div className="space-y-5">
      {/* 左右兩欄佈局：大門控制 + 即時監控 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.5fr]">
        {/* 左側：大門機制控制 */}
        <div className="space-y-4">
          {/* 大門控制卡片 */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">大門機制控制</h2>

            {/* 一鍵開門按鈕 */}
            <DoorRemoteCard state={doorState} canRemote={canRemote} embedded />

            {/* 間距 */}
            <div className="my-4" />

            {/* 大門常開模式 */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-900">
                大門常開模式
              </label>
              <AlwaysOpenToggle
                isOpen={doorState.alwaysOpen}
                canControl={canRemote}
                embedded
              />
            </div>

            {/* 間距 */}
            <div className="my-4" />

            {/* 連線狀態 */}
            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="text-sm text-zinc-600">
                {doorState.connection === 'NOT_CONNECTED' ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-gray-400" aria-hidden />
                    未連線
                  </span>
                ) : doorState.connection === 'CONNECTED' ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
                    已連線
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
                    連線錯誤
                  </span>
                )}
              </p>
            </div>
          </section>
        </div>

        {/* 右側：即時監控 */}
        <div>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">即時監控 → 01 QR 密碼鎖</h2>

            {/* 即時監控卡片 - 仿真影像區 */}
            <div className="relative overflow-hidden rounded-lg bg-zinc-900" style={{ aspectRatio: '16 / 9' }}>
              {/* Demo 模擬影像容器 */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                <div className="text-center">
                  <p className="text-sm text-zinc-400">尚無即時影像</p>
                  <p className="mt-1 text-xs text-zinc-500">設備尚未連線</p>
                </div>
              </div>

              {/* LIVE 標籤 */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" aria-hidden />
                <span className="text-xs font-bold text-white">LIVE</span>
              </div>

              {/* 設備標籤 */}
              <div className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1">
                <p className="text-xs font-semibold text-white whitespace-nowrap">QR 密碼鎖（門外）</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 手動授權 */}
      {canGrant && (
        <ManualGrantForm members={members.map((m) => ({ id: m.id, label: `${m.displayName}${m.phone ? `（${m.phone.slice(0, 4)}***${m.phone.slice(-3)}）` : ''}` }))} />
      )}

      {/* 設備列表 */}
      <DevicesList />
    </div>
  )
}

function PasswordControlTab({ venue, slotData, isSuperAdmin }: { venue: { id: string; bookAheadDays: number; passwordBookAheadDaysOverride: number | null } | null; slotData: SlotPageData | null; isSuperAdmin: boolean }) {
  return (
    <div className="space-y-5">
      {/* 預約密碼設定 */}
      {slotData && !slotData.ready && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">密碼控制</h2>
          <p className="mt-1 text-xs">此資料庫尚未建立時段密碼資料表（prisma/migrations-manual/2026-11-17b_slot_passwords.sql），套用後即可設定與查看密碼時段。</p>
        </section>
      )}
      {venue && slotData?.ready && (
        <>
          <PasswordSettings settings={slotData.settings} defaultBookAheadDays={venue.bookAheadDays} isSuperAdmin={isSuperAdmin} />
          <SlotPasswordRecords stats={slotData.stats} records={slotData.records} />
        </>
      )}
      {!venue && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">密碼控制</h2>
          <p className="mt-1 text-xs">尚未建立場館資料，無法設定密碼。</p>
        </section>
      )}
    </div>
  )
}

function DevicesList() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">設備列表</h2>
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
      <p className="border-t border-zinc-100 px-4 py-3 text-xs text-muted">設備狀態僅供查看，密碼與授權設定請至「密碼控制」。</p>
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
  if (rows.length === 0) return <Empty title="尚無開門與授權紀錄" desc="建立、更新或撤銷門禁授權與遠端開門時，系統與管理者的每一次操作都會記錄在這裡。" />
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">開門與授權紀錄｜誰在什麼時間授權誰進場（最近 100 筆）</h2>
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
