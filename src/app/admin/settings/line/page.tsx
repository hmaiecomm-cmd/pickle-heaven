import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin-auth'
import { ASSIGNABLE_ROLES, ROLE_LABEL, can, type AdminRole } from '@/lib/admin-permissions'
import { mainPrisma } from '@/lib/db'
import { formatDateTime } from '@/lib/time'
import { PageTitle, Pill } from '@/components/admin/page-bits'
import { lineConfig, readNotice } from '@/server/admin-line-oauth'
import { inviteState, listBindings, listInvitations, loginHistory, myBinding } from '@/server/admin-line-access'
import { InviteForm, RevokeInvite, Unbind } from './line-client'

export const metadata: Metadata = { title: 'LINE 登入與邀請' }
export const dynamic = 'force-dynamic'

const INVITE_TONE = { PENDING: 'blue', USED: 'green', EXPIRED: 'gray', REVOKED: 'red' } as const
const INVITE_LABEL = { PENDING: '待接受', USED: '已使用', EXPIRED: '已過期', REVOKED: '已撤銷' } as const
const ACTION_LABEL: Record<string, string> = {
  ADMIN_INVITE_CREATE: '建立邀請',
  ADMIN_INVITE_REVOKE: '撤銷邀請',
  ADMIN_INVITE_ACCEPT: '接受邀請並建立帳號',
  ADMIN_LINE_BIND: '綁定 LINE',
  ADMIN_LINE_UNBIND: '解除 LINE 綁定',
}

/** 只顯示 LINE 使用者識別碼的頭尾，避免完整外洩 */
const maskKey = (k: string) => (k.startsWith('line:') ? `LINE ${k.slice(5, 9)}…${k.slice(-4)}` : k)
const maskIp = (ip: string) => ip.replace(/(\d+)\.(\d+)$/, '*.*')

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {desc && <p className="mt-0.5 text-[11px] text-muted">{desc}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default async function LineSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/admin/login')
  const params = await searchParams
  const notice = readNotice(params, 'line_notice')
  const error = readNotice(params)
  const cfg = lineConfig()
  const isOwner = can(ctx.role, 'staff')
  const mine = await myBinding(ctx.accountId)

  const [invites, bindings, history, venues] = isOwner
    ? await Promise.all([listInvitations(), listBindings(), loginHistory(), mainPrisma.venue.findMany({ where: { active: true }, select: { id: true, name: true } })])
    : [[], [], { attempts: [], actions: [] }, []]
  const now = new Date()

  return (
    <div className="space-y-5">
      <PageTitle title="LINE 登入與邀請" desc="以 LINE 登入後台、邀請新管理員、管理綁定與查看登入紀錄。LINE 官方帳號的管理員不等於本系統管理員。" />

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!cfg.configured && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">LINE 登入尚未設定完成，目前只能用帳號密碼登入。</p>
          <p className="mt-1">缺少：{cfg.missing.join('、')}</p>
          {cfg.callbackUrl && <p className="mt-1 break-all">需在 LINE Developers 登記的 Callback URL：{cfg.callbackUrl}</p>}
          {isOwner && (
            <p className="mt-2">
              在 LINE 設定完成前，可以到{' '}
              <Link href="/admin/settings/staff" className="font-semibold underline">
                後台帳號與權限
              </Link>{' '}
              直接為管理員建立帳號與初始密碼，對方首次登入時必須更換密碼。
            </p>
          )}
        </div>
      )}

      <Section title="我的 LINE 綁定" desc={`帳號 ${ctx.username}・${ROLE_LABEL[ctx.role]}`}>
        {mine ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              已綁定 <span className="font-medium">{mine.displayName}</span>
              <span className="text-muted">（{formatDateTime(mine.linkedAt)} 綁定{mine.lastLoginAt ? `，最後以 LINE 登入 ${formatDateTime(mine.lastLoginAt)}` : ''}）</span>
            </p>
            <Unbind id={mine.id} self />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted">尚未綁定 LINE。綁定後可以直接用 LINE 登入這個帳號。</p>
            {cfg.configured ? (
              <a href="/api/admin/auth/line/start?intent=bind" className="inline-flex h-9 items-center rounded-xl bg-[#06C755] px-3 text-sm font-semibold text-white hover:bg-[#05b34c]">
                綁定我的 LINE
              </a>
            ) : (
              <span className="text-xs text-amber-700">LINE 登入設定完成後才能綁定</span>
            )}
          </div>
        )}
      </Section>

      {isOwner && (
        <>
          <Section
            title="邀請管理員（以 LINE 登入）"
            desc="邀請只能指派管理員或工作人員，不能指派擁有者。邀請連結只顯示一次，過期、使用過或撤銷後即失效。不使用 LINE 的人員，請到「後台帳號與權限」建立帳號密碼。"
          >
            <InviteForm roles={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} venues={venues} />
          </Section>

          <Section title="邀請紀錄">
            {invites.length === 0 ? (
              <p className="text-sm text-muted">尚未建立邀請。</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {invites.map((i) => {
                  const st = inviteState(i, now)
                  return (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {ROLE_LABEL[i.role as AdminRole] ?? i.role}
                        <span className="ml-2 text-xs text-muted">
                          {i.createdBy} 建立於 {formatDateTime(i.createdAt)}・有效至 {formatDateTime(i.expiresAt)}
                          {i.note ? `・${i.note}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Pill tone={INVITE_TONE[st]}>{INVITE_LABEL[st]}</Pill>
                        {st === 'PENDING' && <RevokeInvite id={i.id} />}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section title="LINE 綁定清單" desc="只有這裡列出且有效的綁定能以 LINE 登入後台。">
            {bindings.length === 0 ? (
              <p className="text-sm text-muted">目前沒有任何 LINE 綁定。</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {bindings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{b.account?.username ?? '（帳號已不存在）'}</span>
                      <span className="ml-2 text-xs text-muted">
                        {b.account ? ROLE_LABEL[b.account.role as AdminRole] : ''}・LINE {b.displayName}・{formatDateTime(b.linkedAt)} 綁定
                        {b.lastLoginAt ? `・最後登入 ${formatDateTime(b.lastLoginAt)}` : ''}
                      </span>
                    </span>
                    {b.revokedAt ? <Pill tone="gray">已解除（{b.revokedBy}）</Pill> : <Unbind id={b.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="登入紀錄（最近 100 筆）" desc="密碼與 LINE 登入；LINE 識別碼與 IP 只顯示部分">
              {history.attempts.length === 0 ? (
                <p className="text-sm text-muted">尚無紀錄。</p>
              ) : (
                <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto text-xs">
                  {history.attempts.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 py-1.5">
                      <span>
                        {formatDateTime(a.createdAt)}・{maskKey(a.usernameKey)}
                      </span>
                      <span className="flex items-center gap-2 text-muted">
                        {maskIp(a.ip)}
                        <Pill tone={a.success ? 'green' : 'red'}>{a.success ? '成功' : '失敗'}</Pill>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="綁定與邀請操作紀錄">
              {history.actions.length === 0 ? (
                <p className="text-sm text-muted">尚無紀錄。</p>
              ) : (
                <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto text-xs">
                  {history.actions.map((r) => (
                    <li key={r.id} className="py-1.5">
                      {formatDateTime(r.createdAt)}・{r.actor}・{ACTION_LABEL[r.action] ?? r.action}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
