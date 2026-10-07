import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Coins, Ticket } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { LoginPrompt } from '@/components/login-prompt'
import { LogoutButton } from '@/components/account-actions'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ntd } from '@/lib/utils'
import { brand } from '@/config/site'

export const metadata: Metadata = { title: '我的帳戶' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getSessionUser()

  if (!user) {
    return <LoginPrompt title={`登入${brand.name}`} description="使用 LINE 登入即可預約場地、查看訂單與管理點數。" />
  }

  const [vouchers, bookingCount] = await Promise.all([
    prisma.voucher.findMany({
      where: { OR: [{ userId: user.id }, { userId: null }], usedAt: null, bookingId: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.booking.count({ where: { userId: user.id, status: { in: ['PAID', 'COMPLETED'] } } }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">我的帳戶</h1>

      {/* 個人資訊 */}
      <Card>
        <CardContent className="flex items-center gap-4">
          {user.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.pictureUrl}
              alt={user.displayName}
              className="h-14 w-14 rounded-2xl border border-[rgb(var(--border))] object-cover"
            />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-2xl surface-2 text-lg font-semibold">
              {user.displayName.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{user.displayName}</p>
            <p className="mt-0.5 text-xs text-muted tabular">{user.phone ?? '尚未填寫手機號碼'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">已完成</p>
            <p className="text-lg font-semibold tabular">{bookingCount}</p>
          </div>
        </CardContent>
      </Card>

      {/* 點數 */}
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-ball-400/25 text-brand-700 dark:text-ball-300">
            <Coins className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">可用點數</p>
            <p className="text-xs text-muted">1 點折抵 NT$1，取消預約的退款也會回補為點數</p>
          </div>
          <span className="text-xl font-bold tabular">{user.points}</span>
        </CardContent>
      </Card>

      {/* 折價券 */}
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
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[rgb(var(--border))] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      <span className="tabular">{v.code}</span>
                      {v.minSpend > 0 && ` · 滿 ${ntd(v.minSpend)} 可用`}
                    </p>
                  </div>
                  <Badge variant="brand">
                    {v.type === 'AMOUNT' ? `折 ${ntd(v.value)}` : `${v.value / 10} 折`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 連結 */}
      <Card>
        <CardContent className="p-0">
          <Link
            href="/bookings"
            className="flex items-center justify-between px-4 py-3.5 text-sm transition-colors hover:surface-2 sm:px-5"
          >
            我的預約紀錄
            <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" aria-hidden />
          </Link>
          <Separator />
          <Link
            href="/booking"
            className="flex items-center justify-between px-4 py-3.5 text-sm transition-colors hover:surface-2 sm:px-5"
          >
            預約場地
            <ChevronRight className="h-4 w-4 text-[rgb(var(--fg-muted))]" aria-hidden />
          </Link>
        </CardContent>
      </Card>

      <LogoutButton />

      <p className="pb-4 text-center text-[11px] text-muted">{brand.name} · {brand.englishName}</p>
    </div>
  )
}
