import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { listPeople, PAGE_SIZE, type PeopleTab } from '@/server/people-admin'
import { MembersSearchForm } from './search-form'

export const metadata: Metadata = { title: '人員管理' }
export const dynamic = 'force-dynamic'

const TABS: { key: PeopleTab; label: string }[] = [
  { key: 'all', label: '全部會員' },
  { key: 'coaches', label: '教練' },
  { key: 'blacklist', label: '黑名單' },
]
const sel = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-white px-2 text-sm'

type SP = { tab?: string; q?: string; activity?: string; membership?: string; from?: string; to?: string; minPoints?: string; maxPoints?: string; lastBookingDays?: string; page?: string }

/**
 * 會員與教練管理：會員（LINE 登入自動建立；另有停用前留下的 Google 會員）、教練、黑名單。
 * 列表只讀；管理操作在詳情頁並由後端驗證權限。
 */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all') as PeopleTab
  const data = await listPeople({
    tab,
    q: sp.q,
    activity: (sp.activity as 'can_signup' | 'no_activity' | '') ?? '',
    membership: (sp.membership as 'BASIC' | 'VIP' | '') ?? '',
    from: sp.from,
    to: sp.to,
    minPoints: sp.minPoints ? Number(sp.minPoints) : undefined,
    maxPoints: sp.maxPoints ? Number(sp.maxPoints) : undefined,
    lastBookingDays: (sp.lastBookingDays as 7 | 30 | 90 | '' | undefined) ?? '',
    page: Number(sp.page) || 1,
  })
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) u.set(k, v)
    return `/admin/members?${u}`
  }

  const qsTab = (newTab: string) => {
    const u = new URLSearchParams()
    u.set('tab', newTab)
    return `/admin/members?${u}`
  }

  return (
    <div className="space-y-4">
      <PageTitle title="會員與教練" desc="會員於首次以 LINE 登入時自動建立。教練身分與後台角色分開；黑名單是帳戶限制狀態，不改變角色。" />

      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm" aria-label="會員與教練分頁">
        {TABS.map((t) => (
          <Link key={t.key} href={qsTab(t.key)} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === t.key ? 'bg-white shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]'}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      <>
        <MembersSearchForm
          tab={tab}
          currentQuery={{
            q: sp.q,
            activity: sp.activity,
            membership: sp.membership,
            from: sp.from,
            to: sp.to,
            minPoints: sp.minPoints,
            maxPoints: sp.maxPoints,
            lastBookingDays: sp.lastBookingDays,
          }}
          total={data.total}
        />

          {tab === 'coaches' && (
            <>
              {data.coaches.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-muted">
                  目前沒有教練
                </div>
              ) : (
                <>
                  {/* 桌面版：表格 */}
                  <section className="hidden lg:block overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">教練名稱</th>
                          <th className="px-3 py-2 font-medium">聯繫方式</th>
                          <th className="px-3 py-2 font-medium">狀態</th>
                          <th className="px-3 py-2 font-medium">對應會員</th>
                          <th className="px-3 py-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {data.coaches.map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2 font-medium">{c.name}</td>
                            <td className="px-3 py-2 text-xs">{c.phone ?? <span className="text-muted">未提供</span>}</td>
                            <td className="px-3 py-2">
                              <Pill tone={c.status === 'ACTIVE' ? 'green' : c.status === 'ON_LEAVE' ? 'amber' : 'gray'}>
                                {c.status === 'ACTIVE' ? '在職' : c.status === 'ON_LEAVE' ? '請假' : '停用'}
                              </Pill>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {c.userId ? <Link href={`/admin/members/${c.userId}`} className="text-brand-700 hover:underline">檢視會員</Link> : <span className="text-muted">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <Link href={`/admin/coaches/${c.id}`} className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-50">編輯</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  {/* 平板版及手機版：卡片式 */}
                  <section className="lg:hidden space-y-2 rounded-2xl">
                    {data.coaches.map((c) => (
                      <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted mt-1">{c.phone ?? '未提供聯繫方式'}</div>
                            <div className="mt-2">
                              <Pill tone={c.status === 'ACTIVE' ? 'green' : c.status === 'ON_LEAVE' ? 'amber' : 'gray'} className="text-xs">
                                {c.status === 'ACTIVE' ? '在職' : c.status === 'ON_LEAVE' ? '請假' : '停用'}
                              </Pill>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            {c.userId && <Link href={`/admin/members/${c.userId}`} className="text-xs text-brand-700 hover:underline">檢視會員</Link>}
                            <Link href={`/admin/coaches/${c.id}`} className="text-xs text-brand-700 hover:underline">編輯</Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          )}

          {tab !== 'coaches' && (
            <>
          {/* 桌面版：表格 */}
          <section className="hidden lg:block overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">電話</th>
                  <th className="px-3 py-2 font-medium">會員等級</th>
                  <th className="px-3 py-2 font-medium">活動資格</th>
                  <th className="px-3 py-2 text-right font-medium">點數</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted">{tab === 'blacklist' ? '目前沒有黑名單會員' : '沒有符合條件的人員'}</td>
                  </tr>
                )}
                {data.rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/members/${m.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        {m.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{m.name.slice(0, 1)}</span>
                        )}
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{m.email ?? <span className="text-muted">未提供</span>}</td>
                    <td className="px-3 py-2 text-xs">{m.phone ?? <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-2">
                      <Pill tone={m.membershipLevel === 'VIP' ? 'violet' : 'gray'}>
                        {m.membershipLevel === 'VIP' ? 'VIP 會員' : '普通會員'}
                      </Pill>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={m.activityStatus === 'no_activity' ? 'amber' : 'green'}>
                        {m.activityStatus === 'no_activity' ? '禁止報名' : '可報名'}
                      </Pill>
                    </td>
                    <td className="px-3 py-2 text-right tabular text-sm">{m.points}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/members/${m.id}`} className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-50">詳情</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 平板版及手機版：卡片式 */}
          <section className="lg:hidden space-y-2 rounded-2xl">
            {data.rows.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-muted">
                {tab === 'blacklist' ? '目前沒有黑名單會員' : '沒有符合條件的人員'}
              </div>
            ) : (
              data.rows.map((m) => (
                <Link key={m.id} href={`/admin/members/${m.id}`} className="block rounded-2xl border border-zinc-200 bg-white p-3 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    {m.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 shrink-0">{m.name.slice(0, 1)}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted mt-1 space-y-0.5">
                        {m.email && <div className="truncate">{m.email}</div>}
                        {m.phone && <div>{m.phone}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Pill tone={m.membershipLevel === 'VIP' ? 'violet' : 'gray'} className="text-xs">
                          {m.membershipLevel === 'VIP' ? 'VIP' : '普通'}
                        </Pill>
                        <Pill tone={m.activityStatus === 'no_activity' ? 'amber' : 'green'} className="text-xs">
                          {m.activityStatus === 'no_activity' ? '禁止報名' : '可報名'}
                        </Pill>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium tabular">{m.points}</div>
                      <div className="text-xs text-muted">點數</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </section>

          {data.pages > 1 && (
            <nav className="flex items-center justify-end gap-2 text-sm" aria-label="分頁">
              <span className="text-xs text-muted">第 {data.page}／{data.pages} 頁（每頁 {PAGE_SIZE} 位）</span>
              {data.page > 1 && <Link href={qs({ page: String(data.page - 1) })} className="rounded-lg border border-zinc-300 px-3 py-1">上一頁</Link>}
              {data.page < data.pages && <Link href={qs({ page: String(data.page + 1) })} className="rounded-lg border border-zinc-300 px-3 py-1">下一頁</Link>}
            </nav>
          )}
            </>
          )}
        </>
    </div>
  )
}
