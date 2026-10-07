import type { Metadata } from 'next'
import Link from 'next/link'
import { RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { pagePermission } from '@/lib/admin-auth'
import { zonedParts } from '@/lib/timezone'
import { now } from '@/lib/time'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { FixCourtsButton } from './fix-courts-button'
import { SyncOccupancyButton } from './sync-button'

export const metadata: Metadata = { title: '場次與週期安排' }
export const dynamic = 'force-dynamic'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'brand'

const SESSION_STATUS: Record<SessionStatus, { text: string; tone: Tone }> = {
  DRAFT: { text: '草稿', tone: 'neutral' },
  SCHEDULED: { text: '尚未開放', tone: 'neutral' },
  OPEN: { text: '開放報名', tone: 'success' },
  FULL: { text: '已額滿', tone: 'danger' },
  LOCKED: { text: '已鎖定', tone: 'warn' },
  PLAYING: { text: '進行中', tone: 'brand' },
  COMPLETED: { text: '已結束', tone: 'neutral' },
  CANCELLED: { text: '已取消', tone: 'neutral' },
}

function fmtDateTime(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  const t = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）${t}`
}
function fmtTime(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/**
 * 場次總覽：所有場次（活動建立的與舊版）一覽，並盤點缺少使用場地或尚未占用場地的既有球敘。
 * 缺場地的場次標示「待補使用場地」，補填時先檢查衝突、確認後才建立占用；不會自動指派。
 */
export default async function AdminSessionsPage() {
  const ctx = await pagePermission('activities')
  if (ctx === 'forbidden') return <Forbidden />

  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, active: true } } },
  })
  const timezone = venue?.timezone ?? 'Asia/Taipei'
  const courts = venue?.courts ?? []
  const at = now()

  const sessions = await prisma.session.findMany({
    where: { deletedAt: null, endAt: { gt: new Date(at.getTime() - 7 * 86_400_000) } },
    orderBy: { startAt: 'asc' },
    take: 120,
    include: {
      venue: { select: { name: true, timezone: true } },
      court: { select: { name: true } },
      courts: { include: { court: { select: { id: true, name: true, sortOrder: true } } } },
      activity: { select: { id: true, title: true, repeatKind: true } },
      template: { select: { title: true } },
      _count: { select: { occupancy: true } },
      registrations: { where: { status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } }, select: { status: true } },
    },
  })

  const rows = sessions.map((s) => {
    const live = s.status !== SessionStatus.CANCELLED && s.status !== SessionStatus.COMPLETED && s.endAt > at
    const courtList = [...s.courts].sort((a, b) => a.court.sortOrder - b.court.sortOrder).map((c) => c.court)
    const missingCourts = live && s.status !== SessionStatus.DRAFT && courtList.length === 0
    const notOccupied = live && s.status !== SessionStatus.DRAFT && courtList.length > 0 && s._count.occupancy === 0
    return {
      s,
      live,
      courtList,
      missingCourts,
      notOccupied,
      confirmed: s.registrations.filter((r) => r.status === RegistrationStatus.CONFIRMED).length,
      waiting: s.registrations.filter((r) => r.status === RegistrationStatus.WAITLISTED).length,
    }
  })
  const missing = rows.filter((r) => r.missingCourts)
  const unoccupied = rows.filter((r) => r.notOccupied)
  const legacyTemplates = await prisma.sessionTemplate.count({ where: { active: true } })

  return (
    <div className="space-y-4">
      <PageTitle
        title="場次與週期安排"
        desc="每個場次獨立名額與場地占用。新增單次或每週固定球敘請用「新增活動」，建立時必須選場地、發布後自動鎖定時段。"
        right={
          <div className="flex gap-2">
            <Link href="/admin/activities" className="inline-flex h-9 items-center rounded-xl border border-[rgb(var(--border))] px-3 text-sm hover:surface-2">活動列表</Link>
            <Link href="/admin/activities/new" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">新增活動</Link>
          </div>
        }
      />

      {/* 既有球敘盤點 */}
      <Card>
        <CardContent className="space-y-2 text-sm">
          <h2 className="font-semibold">既有球敘盤點</h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            <li className={missing.length > 0 ? 'rounded-xl bg-amber-50 px-3 py-2 text-amber-900' : 'rounded-xl surface-2 px-3 py-2'}>
              待補使用場地：<strong>{missing.length}</strong> 場
            </li>
            <li className={unoccupied.length > 0 ? 'rounded-xl bg-amber-50 px-3 py-2 text-amber-900' : 'rounded-xl surface-2 px-3 py-2'}>
              有場地但尚未占用：<strong>{unoccupied.length}</strong> 場
              {unoccupied.length > 0 && <SyncOccupancyButton />}
            </li>
            <li className="rounded-xl surface-2 px-3 py-2">
              舊版週期範本：{legacyTemplates > 0 ? `${legacyTemplates} 個（已停用自動產生，請改用活動的每週重複）` : '無'}
            </li>
          </ul>
          <p className="text-xs text-muted">補填場地時會先檢查與既有預約、暫留、其他活動、維護封場的衝突；有衝突不會建立占用，也不會自動指派到其他場地。</p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">尚未有任何場次。請到「新增活動」建立單次或每週固定球敘。</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[rgb(var(--border))]">
              {rows.map(({ s, courtList, missingCourts, notOccupied, confirmed, waiting }) => {
                const label = SESSION_STATUS[s.status]
                const publicSpots = Math.max(0, s.capacity - s.reservedCapacity)
                const title = `${s.title} ${fmtDateTime(s.startAt, s.venue.timezone)}–${fmtTime(s.endAt, s.venue.timezone)}`
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/sessions/${s.id}`} className="block truncate text-sm font-medium hover:underline">
                        {fmtDateTime(s.startAt, s.venue.timezone)}–{fmtTime(s.endAt, s.venue.timezone)}　{s.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>{courtList.length > 0 ? courtList.map((c) => c.name).join('、') : s.court?.name ?? '未指定場地'}</span>
                        {s.activity && (
                          <Link href={`/admin/activities/${s.activity.id}`} className="text-brand-700 hover:underline">
                            {s.activity.repeatKind === 'WEEKLY' ? '每週活動' : '單次活動'}
                          </Link>
                        )}
                        {s.template && <span>舊版範本：{s.template.title}</span>}
                        {missingCourts && <Badge variant="warn">待補使用場地</Badge>}
                        {notOccupied && <Badge variant="warn">未占用場地</Badge>}
                        {waiting > 0 && <span>候補 {waiting} 人</span>}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">
                      {confirmed} / {publicSpots}
                    </span>
                    <Badge variant={label.tone}>{label.text}</Badge>
                    {(missingCourts || notOccupied) && (
                      <FixCourtsButton sessionId={s.id} label={title} courts={courts} currentCourtIds={courtList.map((c) => c.id)} />
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
