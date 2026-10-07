import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarPlus, ChevronRight, Coins, Ticket } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getSessionUser, SessionUnavailableError } from '@/lib/session'
import { listUserBookings } from '@/server/booking-service'
import { formatRange, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { shortDateLabel } from '@/lib/activity-shared'
import { LoginPrompt } from '@/components/login-prompt'
import { LogoutButton } from '@/components/account-actions'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { Badge, BookingStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ntd } from '@/lib/utils'
import { brand } from '@/config/site'
import { BookingsClient, type BookingCardData } from '@/app/bookings/bookings-client'
import { AccountTabs } from './account-tabs'
import { isAccountTab, type AccountTab } from './tabs'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: '我的帳戶' }
export const dynamic = 'force-dynamic'

const REG_LABEL: Record<string, { label: string; variant: 'success' | 'warn' | 'neutral' | 'danger' | 'brand' }> = {
  CONFIRMED: { label: '已報名', variant: 'success' },
  WAITLISTED: { label: '候補中', variant: 'warn' },
  PENDING: { label: '待付款', variant: 'warn' },
  COMPLETED: { label: '已出席', variant: 'neutral' },
  CANCELLED: { label: '已取消', variant: 'neutral' },
  LATE_CANCEL: { label: '逾期取消', variant: 'danger' },
  NO_SHOW: { label: '未到', variant: 'danger' },
  EXPIRED: { label: '已逾時', variant: 'neutral' },
}

/**
 * 我的帳戶：預約、球敘／活動、訂單、點數／票券、個人資料集中在同一頁，以分頁切換。
 * 預設打開「我的預約」並先列即將到來的預約。
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const tab: AccountTab = isAccountTab(sp.tab) ? sp.tab : 'bookings'
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (err) {
    if (err instanceof SessionUnavailableError) return <Unavailable />
    throw err
  }

  if (!user) {
    return (
      <LoginPrompt
        title={`登入${brand.name}`}
        description="登入後可查看預約、球敘報名、訂單與點數。登入完成會回到這一頁。"
        next={`/account?tab=${tab}`}
      />
    )
  }

  const [{ upcoming, past, cancelled, all }, regs, vouchers, profile] = await Promise.all([
    listUserBookings(user.id),
    prisma.sessionRegistration.findMany({
      where: { userId: user.id, status: { notIn: ['EXPIRED'] } },
      include: { session: { select: { id: true, title: true, startAt: true, endAt: true, status: true, venue: { select: { name: true } } } } },
      orderBy: { session: { startAt: 'desc' } },
      take: 60,
    }),
    prisma.voucher.findMany({
      where: { OR: [{ userId: user.id }, { userId: null }], usedAt: null, bookingId: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { email: true, googleSub: true, createdAt: true } }),
  ])

  const toCard = (b: (typeof all)[number]): BookingCardData => {
    const base = taipeiToUtc(b.playDate, 0).getTime()
    const minute = (d: Date) => Math.round((d.getTime() - base) / 60_000)
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      playDate: b.playDate,
      venueName: b.venue.name,
      total: b.total,
      slots: [
        ...b.items.map((it) => ({ courtName: it.courtName, label: formatRange(minute(it.startsAt), minute(it.endsAt)) })),
        ...b.activityItems.map((it) => ({ courtName: `活動・${it.title} ×${it.quantity}`, label: formatRange(minute(it.startsAt), minute(it.endsAt)) })),
      ],
    }
  }

  // 球敘／活動：即將到來的排前面
  const today = taipeiDateString()
  const nowMinute = taipeiMinuteOfDay()
  const regView = regs.map((r) => {
    const date = taipeiDateString(r.session.startAt)
    const start = taipeiMinuteOfDay(r.session.startAt)
    const end = start + Math.round((r.session.endAt.getTime() - r.session.startAt.getTime()) / 60_000)
    const isUpcoming = date > today || (date === today && end > nowMinute)
    return { id: r.id, sessionId: r.session.id, title: r.session.title, venueName: r.session.venue.name, date, timeLabel: formatRange(start, end), quantity: r.quantity, status: r.status, isUpcoming }
  })
  const regsUpcoming = regView.filter((r) => r.isUpcoming).sort((a, b) => a.date.localeCompare(b.date))
  const regsPast = regView.filter((r) => !r.isUpcoming)

  const counts = { bookings: upcoming.length, activities: regsUpcoming.length }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        {user.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.pictureUrl} alt="" className="h-12 w-12 rounded-2xl border border-[rgb(var(--border))] object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-base font-semibold text-brand-700">{user.displayName.slice(0, 1)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{user.displayName}</h1>
          <p className="text-xs text-muted">
            可用點數 <span className="font-semibold text-brand-700 tabular">{user.points}</span>
            {upcoming.length > 0 && <>・即將到來 {upcoming.length} 筆預約</>}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/booking">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            預約場地
          </Link>
        </Button>
      </div>

      <AccountTabs current={tab} counts={counts} />

      {tab === 'bookings' && (
        <section aria-label="我的預約" className="space-y-3">
          <p className="text-xs text-muted">先列即將到來的預約；點進訂單可查看詳情、分享或取消。</p>
          <BookingsClient upcoming={upcoming.map(toCard)} past={past.map(toCard)} cancelled={cancelled.map(toCard)} />
        </section>
      )}

      {tab === 'activities' && (
        <section aria-label="我的球敘與活動" className="space-y-4">
          <RegList title="即將參加" items={regsUpcoming} empty="目前沒有即將參加的球敘或活動" />
          {regsPast.length > 0 && <RegList title="過往紀錄" items={regsPast} empty="" muted />}
          <div className="text-right">
            <Link href="/sessions" className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
              看看有哪些球敘
            </Link>
          </div>
        </section>
      )}

      {tab === 'orders' && (
        <section aria-label="我的訂單">
          {all.length === 0 ? (
            <Empty text="還沒有任何訂單" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-[rgb(var(--border))]">
                  {all.map((b) => (
                    <li key={b.id}>
                      <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:surface-2 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            <span className="font-mono text-xs text-muted">{b.code}</span>
                            <BookingStatusBadge status={b.status} />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {shortDateLabel(b.playDate)}・{[b.items.length > 0 && `場地 ${b.items.length} 時段`, b.activityItems.length > 0 && `活動 ${b.activityItems.length} 項`].filter(Boolean).join('、')}
                            ・下單 {b.createdAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular">{ntd(b.total)}</span>
                        <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {tab === 'points' && (
        <section aria-label="點數與票券" className="space-y-4">
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Coins className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">可用點數</p>
                <p className="text-xs text-muted">1 點折抵 NT$1；取消預約的退款會回補為點數，結帳時可直接折抵</p>
              </div>
              <span className="text-xl font-bold tabular">{user.points}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Ticket className="h-4 w-4" aria-hidden />
                我的折價券
              </h2>
              <Separator />
              {vouchers.length === 0 ? (
                <p className="py-2 text-xs text-muted">目前沒有可使用的折價券</p>
              ) : (
                <ul className="space-y-2">
                  {vouchers.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          <span className="tabular">{v.code}</span>
                          {v.minSpend > 0 && ` · 滿 ${ntd(v.minSpend)} 可用`}
                        </p>
                      </div>
                      <Badge variant="brand">{v.type === 'AMOUNT' ? `折 ${ntd(v.value)}` : `${v.value / 10} 折`}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {tab === 'profile' && (
        <section aria-label="個人資料" className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <ProfileForm displayName={user.displayName} phone={user.phone} />
              <Separator />
              <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">登入方式</dt>
                <dd>{profile?.googleSub ? 'Google 帳號' : '—'}</dd>
                <dt className="text-muted">Email</dt>
                <dd className="truncate">{profile?.email ?? '—'}</dd>
                <dt className="text-muted">加入日期</dt>
                <dd>{profile?.createdAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) ?? '—'}</dd>
              </dl>
            </CardContent>
          </Card>
          <LogoutButton />
        </section>
      )}

      <p className="pb-4 text-center text-[11px] text-muted">
        {brand.name} · {brand.englishName}
      </p>
    </div>
  )
}

/** 登入狀態暫時無法確認：顯示重試，不清除登入、不導向 Google */
function Unavailable() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-base font-semibold">暫時無法確認登入狀態</p>
      <p className="mt-1 text-sm text-muted">連線或伺服器暫時異常，您的登入沒有被登出。</p>
      <a href="/account" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white">重試</a>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] px-4 py-8 text-center text-sm text-muted">{text}</p>
}

function RegList({
  title,
  items,
  empty,
  muted = false,
}: {
  title: string
  items: { id: string; sessionId: string; title: string; venueName: string; date: string; timeLabel: string; quantity: number; status: string }[]
  empty: string
  muted?: boolean
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-[rgb(var(--border))]">
              {items.map((r) => {
                const s = REG_LABEL[r.status] ?? { label: r.status, variant: 'neutral' as const }
                return (
                  <li key={r.id}>
                    <Link href={`/booking?date=${r.date}&session=${r.sessionId}`} className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:surface-2 sm:px-5 ${muted ? 'opacity-70' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="mt-0.5 text-xs text-muted tabular">
                          {shortDateLabel(r.date)} {r.timeLabel}・{r.venueName}・{r.quantity} 位
                        </p>
                      </div>
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" aria-hidden />
                    </Link>
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
