import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { mainPrisma } from '@/lib/db'
import { ROLE_LABEL, ROLE_SUMMARY, type AdminRole } from '@/lib/admin-permissions'
import { formatDateTime } from '@/lib/time'
import { Card, CardContent } from '@/components/ui/card'
import { lineConfig, readNotice } from '@/server/admin-line-oauth'
import { findInvitation, inviteState } from '@/server/admin-line-access'

export const metadata: Metadata = { title: '接受後台邀請', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const STATE_MESSAGE = {
  EXPIRED: '這個邀請已過期，請向擁有者索取新的邀請。',
  USED: '這個邀請已經被使用過。若你已完成綁定，請直接使用 LINE 登入。',
  REVOKED: '這個邀請已被撤銷。',
} as const

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const inv = await findInvitation(token)
  const state = inv ? inviteState(inv) : null
  const venue = inv?.venueId ? await mainPrisma.venue.findUnique({ where: { id: inv.venueId }, select: { name: true } }) : null
  const error = readNotice(await searchParams)
  const lineReady = lineConfig().configured

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Card>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-3 text-base font-semibold">Pickle Heaven 後台邀請</h1>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!inv ? (
            <p className="rounded-lg bg-zinc-50 px-3 py-3 text-sm text-zinc-700">邀請連結無效，請確認網址是否完整。</p>
          ) : state !== 'PENDING' ? (
            <p className="rounded-lg bg-zinc-50 px-3 py-3 text-sm text-zinc-700">{STATE_MESSAGE[state as keyof typeof STATE_MESSAGE]}</p>
          ) : (
            <>
              <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-muted">角色</dt>
                  <dd className="font-medium">{ROLE_LABEL[inv.role as AdminRole] ?? inv.role}</dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-muted">球館範圍</dt>
                  <dd>{venue?.name ?? '全部球館'}</dd>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <dt className="text-muted">有效期限</dt>
                  <dd>{formatDateTime(inv.expiresAt)} 前</dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-muted">{ROLE_SUMMARY[inv.role as AdminRole]}</p>
              {lineReady ? (
                <a
                  href={`/api/admin/auth/line/start?intent=invite&token=${encodeURIComponent(token)}`}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#06C755] text-sm font-semibold text-white hover:bg-[#05b34c]"
                >
                  使用 LINE 接受邀請
                </a>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">LINE 登入尚未設定完成，暫時無法接受邀請，請聯絡擁有者。</p>
              )}
              <p className="text-center text-[11px] text-muted">接受後，你的 LINE 帳號會綁定到這個後台帳號，之後以 LINE 登入。</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
