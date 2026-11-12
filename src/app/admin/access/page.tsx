import type { Metadata } from 'next'
import Link from 'next/link'
import { DoorClosed, History, KeyRound, ListChecks, ShieldAlert } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
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
import { ManualGrantForm, ReconcileButton, RevokeButton } from './access-client'

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
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if ((await pagePermission('device.control')) === 'forbidden') return <Forbidden />
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

      {tab === 'grants' && <GrantsTab />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'logs' && (
        <Empty title="尚無進出紀錄" desc="進出紀錄由門禁控制器回報。目前尚未串接門禁控制器，因此沒有任何紀錄；串接後會在這裡顯示每次刷卡、密碼或開門的時間與結果。" />
      )}
      {tab === 'alerts' && (
        <Empty title="尚無異常事件" desc="異常事件（例如授權下發失敗、控制器離線、時鐘偏差）由門禁控制器與監控程式產生。目前尚未串接，因此沒有資料。" />
      )}
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

async function GrantsTab() {
  const at = now()
  const [grants, members] = await Promise.all([
    listGrants(),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: 500, select: { id: true, displayName: true, phone: true } }),
  ])
  const bookingIds = grants.map((g) => g.bookingId).filter((x): x is string => Boolean(x))
  const codes = new Map((await prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, code: true } })).map((b) => [b.id, b.code]))
  const counts = grants.reduce<Record<GrantPhase, number>>((acc, g) => ((acc[grantPhase(g, at)] += 1), acc), { ACTIVE: 0, UPCOMING: 0, EXPIRED: 0, REVOKED: 0 })

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">預約自動授權規則</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>訂單付款成功後，自動建立授權（會員在黑名單中則不建立）。</li>
          <li>
            有效期間：第一個時段開始前 {ACCESS_BUFFER_BEFORE_MINUTES} 分鐘，到最後一個時段結束後 {ACCESS_BUFFER_AFTER_MINUTES} 分鐘。
          </li>
          <li>訂單取消、逾時或待退款時自動撤銷；時間到自動失效。</li>
          <li>管理者手動撤銷的預約授權，不會被系統自動恢復。</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ReconcileButton />
          <span className="text-xs text-muted">若懷疑有訂單漏建或漏撤銷授權，可按此重新比對。</span>
        </div>
      </section>

      <ManualGrantForm members={members.map((m) => ({ id: m.id, label: `${m.displayName}${m.phone ? `（${m.phone.slice(0, 4)}***${m.phone.slice(-3)}）` : ''}` }))} />

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
                  <div className="md:justify-self-end">{(phase === 'ACTIVE' || phase === 'UPCOMING') && <RevokeButton id={g.id} name={g.holderName} />}</div>
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

async function AuditTab() {
  const rows = await listDoorAudit()
  if (rows.length === 0) return <Empty title="尚無操作紀錄" desc="建立、更新或撤銷門禁授權時，系統與管理者的每一次操作都會記錄在這裡。" />
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
