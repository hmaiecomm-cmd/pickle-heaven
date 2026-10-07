import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { listPeople, PAGE_SIZE, type PeopleTab } from '@/server/people-admin'

export const metadata: Metadata = { title: '人員管理' }
export const dynamic = 'force-dynamic'

const TABS: { key: PeopleTab; label: string }[] = [
  { key: 'all', label: '全部會員' },
  { key: 'coaches', label: '教練' },
  { key: 'staff', label: '工作人員與管理員' },
  { key: 'blacklist', label: '黑名單' },
]
const sel = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-white px-2 text-sm'

type SP = { tab?: string; q?: string; role?: string; status?: string; from?: string; to?: string; sort?: string; page?: string }

/**
 * 人員管理：會員（Google 登入自動建立）、教練、工作人員與管理員、黑名單。
 * 列表只讀；管理操作在詳情頁並由後端驗證權限。
 */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all') as PeopleTab
  const data = await listPeople({
    tab,
    q: sp.q,
    role: (sp.role as 'member' | 'coach' | 'staff' | '') ?? '',
    status: (sp.status as 'normal' | 'restricted' | '') ?? '',
    from: sp.from,
    to: sp.to,
    sort: (sp.sort as 'joined' | 'login' | 'points' | 'name') ?? 'joined',
    page: Number(sp.page) || 1,
  })
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) u.set(k, v)
    return `/admin/members?${u}`
  }

  return (
    <div className="space-y-4">
      <PageTitle title="人員管理" desc="會員於首次 Google 登入時自動建立（同一 Google 帳號不會重複新增）。教練身分與後台角色分開；黑名單是帳戶限制狀態，不改變角色。" />

      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm" aria-label="人員分頁">
        {TABS.map((t) => (
          <Link key={t.key} href={qs({ tab: t.key, page: undefined })} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === t.key ? 'bg-white shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]'}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'staff' ? (
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <ul className="divide-y divide-zinc-100 text-sm">
            {data.staff.length === 0 && <li className="p-6 text-center text-muted">展示環境不顯示真實員工帳號；正式環境請以擁有者登入。</li>}
            {data.staff.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-semibold">{a.username}</span>
                  <span className="ml-2 text-xs text-muted">{a.displayName}・最近登入 {a.lastLoginAt ?? '—'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Pill tone="blue">{a.roleLabel}</Pill>
                  <Pill tone={a.active ? 'green' : 'gray'}>{a.active ? '啟用' : '停用'}</Pill>
                  {a.userId ? <Link href={`/admin/members/${a.userId}`} className="text-xs text-brand-700 hover:underline">對應會員</Link> : <span className="text-xs text-muted">未對應會員</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-muted">新增、停用、重設密碼請到「設定管理 → 員工帳號與權限」（擁有者）。</p>
        </section>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgb(var(--border))] bg-white p-3" aria-label="篩選人員">
            <input type="hidden" name="tab" value={tab} />
            <input name="q" defaultValue={sp.q ?? ''} placeholder="姓名、Email 或電話" className={`${sel} w-56`} aria-label="搜尋人員" />
            {tab === 'all' && (
              <select name="role" defaultValue={sp.role ?? ''} className={sel} aria-label="角色">
                <option value="">全部角色</option>
                <option value="member">一般會員</option>
                <option value="coach">教練</option>
                <option value="staff">工作人員／管理員</option>
              </select>
            )}
            {tab !== 'blacklist' && (
              <select name="status" defaultValue={sp.status ?? ''} className={sel} aria-label="帳戶狀態">
                <option value="">全部狀態</option>
                <option value="normal">正常</option>
                <option value="restricted">受限（黑名單）</option>
              </select>
            )}
            <input type="date" name="from" defaultValue={sp.from ?? ''} className={sel} aria-label="加入日期（起）" />
            <span className="text-xs text-muted">～</span>
            <input type="date" name="to" defaultValue={sp.to ?? ''} className={sel} aria-label="加入日期（迄）" />
            <select name="sort" defaultValue={sp.sort ?? 'joined'} className={sel} aria-label="排序">
              <option value="joined">加入日期（新→舊）</option>
              <option value="login">最近登入</option>
              <option value="points">點數餘額</option>
              <option value="name">姓名</option>
            </select>
            <button type="submit" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">搜尋</button>
            <Link href={`/admin/members?tab=${tab}`} className="text-xs text-muted hover:underline">清除條件</Link>
            <span className="ml-auto text-xs text-muted">共 {data.total} 位</span>
          </form>

          {tab === 'coaches' && data.coaches.length > 0 && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">教練名冊（教練資料）</h2>
              <p className="text-xs text-muted">教練的授課時段與時薪在「活動管理 → 教練」維護；這裡列出名冊與對應會員。</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.coaches.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-200 px-3 py-1.5">
                    {c.name}
                    <span className="ml-1 text-xs text-muted">{c.status === 'ACTIVE' ? '在職' : c.status === 'ON_LEAVE' ? '請假' : '停用'}</span>
                    {c.userId && <Link href={`/admin/members/${c.userId}`} className="ml-2 text-xs text-brand-700 hover:underline">對應會員</Link>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">Email（Google 驗證）</th>
                  <th className="px-3 py-2 font-medium">電話</th>
                  <th className="px-3 py-2 font-medium">角色</th>
                  <th className="px-3 py-2 font-medium">帳戶狀態</th>
                  <th className="px-3 py-2 text-right font-medium">點數</th>
                  <th className="px-3 py-2 font-medium">可提前預約</th>
                  <th className="px-3 py-2 font-medium">加入／最近登入</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted">{tab === 'blacklist' ? '目前沒有黑名單會員' : '沒有符合條件的人員'}</td>
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
                    <td className="px-3 py-2 text-xs">{m.email ? <>{m.email}{m.emailVerified && <span className="ml-1 text-emerald-700">✓</span>}</> : <span className="text-muted">未提供</span>}</td>
                    <td className="px-3 py-2 text-xs tabular">{m.phone ?? <span className="text-muted">未填寫</span>}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Pill key={r} tone={r === '會員' ? 'gray' : r === '教練' ? 'violet' : 'blue'}>{r}</Pill>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={m.status === 'normal' ? 'green' : m.status === 'restricted' ? 'red' : 'amber'}>{m.statusLabel}</Pill>
                      {m.blacklistUntil && <span className="block text-[11px] text-muted">至 {m.blacklistUntil}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{m.points}</td>
                    <td className="px-3 py-2 text-xs text-muted">{m.bookAhead ? `${m.bookAhead} 天` : '場館預設'}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {m.joinedAt}
                      <span className="block">{m.lastLoginAt ? `登入 ${m.lastLoginAt}` : '尚未以 Google 登入'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/members/${m.id}`} className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-50">查看詳情</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  )
}
