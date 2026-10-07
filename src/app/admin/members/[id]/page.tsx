import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'
import { getMemberDetail, type MemberDetailTab } from '@/server/people-admin'
import { CoachToggle, NotePanel, PointsPanel, RestrictionPanel, VoucherIssuePanel, VoucherRevokeButton } from './panels'

export const metadata: Metadata = { title: '會員詳情' }
export const dynamic = 'force-dynamic'

const TABS: { key: MemberDetailTab; label: string }[] = [
  { key: 'profile', label: '基本資料' },
  { key: 'bookings', label: '預約與活動' },
  { key: 'orders', label: '訂單與消費' },
  { key: 'points', label: '點數與票券' },
  { key: 'roles', label: '角色與預約資格' },
  { key: 'logs', label: '管理紀錄' },
]
const money = (n: number) => `NT$${n.toLocaleString()}`
const BOOKING_LABEL: Record<string, string> = { PENDING: '待付款', PAID: '已付款', COMPLETED: '已完成', CANCELLED: '已取消', EXPIRED: '已逾時', REFUND_PENDING: '款項待退' }
const sel = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm'

type SP = { tab?: string; dateType?: string; from?: string; to?: string }

/**
 * 會員詳情：六個分頁。所有管理操作由後端驗證權限並記錄；內部備註與限制原因僅後台可見。
 */
export default async function MemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const ctx = await pagePermission('members')
  if (ctx === 'forbidden') return <Forbidden />
  const { id } = await params
  const sp = await searchParams
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : 'profile') as MemberDetailTab
  const dateType = sp.dateType === 'play' ? 'play' : 'created'
  const d = await getMemberDetail(id, tab === 'orders' ? { dateType, from: sp.from, to: sp.to } : {})
  if (!d) notFound()
  const u = d.user
  const showMoney = can(ctx.role, 'finance') || can(ctx.role, 'bookings')
  const canRestrict = can(ctx.role, 'members.restrict')
  const canPoints = can(ctx.role, 'finance')
  const canVoucher = can(ctx.role, 'marketing')
  const canNote = can(ctx.role, 'members')
  const roles = [u.staff ? `${u.staff.roleLabel}（後台）` : null, u.isCoach || u.coach ? '教練' : null].filter(Boolean) as string[]
  const href = (t: MemberDetailTab) => `/admin/members/${u.id}?tab=${t}`
  const upcomingBookings = d.bookings.filter((b) => b.upcoming)
  const pastBookings = d.bookings.filter((b) => !b.upcoming)
  const upcomingRegs = d.registrations.filter((r) => r.upcoming)
  const pastRegs = d.registrations.filter((r) => !r.upcoming)

  return (
    <div className="space-y-4">
      <PageTitle
        title={u.name}
        desc={`會員 #${u.id.slice(-6)}・加入 ${u.joinedAt}・${u.lastLoginAt ? `最近登入 ${u.lastLoginAt}` : '尚未以 Google 登入'}`}
        right={<Link href="/admin/members" className="text-sm text-brand-700 hover:underline">← 人員列表</Link>}
      />

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        {u.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{u.name.slice(0, 1)}</span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{u.name}</span>
            <Pill tone="gray">會員</Pill>
            {roles.map((r) => <Pill key={r} tone={r === '教練' ? 'violet' : 'blue'}>{r}</Pill>)}
            <Pill tone={u.restricted ? 'red' : 'green'}>{u.restricted ? '受限（黑名單）' : '正常'}</Pill>
          </p>
          <p className="text-xs text-muted">{u.email ? `${u.email}${u.emailVerified ? '（Google 驗證）' : ''}` : 'Email 未提供'}・電話 {u.phone ?? '未填寫'}・點數 {u.points}</p>
        </div>
        {showMoney && <div className="text-right text-xs text-muted">累計實付 <span className="font-semibold text-[rgb(var(--fg))]">{money(d.money.paid)}</span><br />已退 {money(d.money.refunded)}</div>}
      </section>

      <nav className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1 text-sm" aria-label="會員詳情分頁">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === t.key ? 'bg-white shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]'}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="基本資料">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">姓名</dt><dd>{u.name}</dd>
              <dt className="text-muted">Email</dt><dd>{u.email ?? '未提供'}{u.emailVerified && <span className="ml-1 text-xs text-emerald-700">Google 已驗證</span>}</dd>
              <dt className="text-muted">電話</dt><dd>{u.phone ?? <span className="text-muted">未填寫</span>}</dd>
              <dt className="text-muted">登入方式</dt><dd>{u.loginMethod}</dd>
              <dt className="text-muted">加入時間</dt><dd>{u.joinedAt}</dd>
              <dt className="text-muted">最近登入</dt><dd>{u.lastLoginAt ?? '—'}</dd>
              <dt className="text-muted">會員編號</dt><dd className="font-mono text-xs">{u.id}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">姓名、Email、頭像來自 Google 帳號；電話由會員在前台自行填寫。</p>
          </Card>
          <Card title="內部備註（僅後台可見）">
            <NotePanel userId={u.id} note={u.adminNote} canEdit={canNote} />
          </Card>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-4">
          <Card title={`即將到來的預約（${upcomingBookings.length}）`}>
            <BookingList rows={upcomingBookings} showMoney={showMoney} empty="沒有即將到來的場地預約" />
          </Card>
          <Card title={`即將到來的活動報名（${upcomingRegs.length}）`}>
            <RegList rows={upcomingRegs} empty="沒有即將到來的活動報名" />
          </Card>
          <Card title="歷史預約">
            <BookingList rows={pastBookings} showMoney={showMoney} empty="沒有歷史預約" />
          </Card>
          <Card title="歷史活動報名">
            <RegList rows={pastRegs} empty="沒有歷史活動報名" />
            <p className="mt-2 text-xs text-muted">「未到場」只依點名紀錄顯示；時間已過但未點名會顯示「已結束（未點名）」，不會推定為未到。</p>
          </Card>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3" aria-label="訂單篩選">
            <input type="hidden" name="tab" value="orders" />
            <select name="dateType" defaultValue={dateType} className={sel} aria-label="日期類型">
              <option value="created">下單日期</option>
              <option value="play">使用日期</option>
            </select>
            <input type="date" name="from" defaultValue={sp.from ?? ''} className={sel} aria-label="起" />
            <span className="text-xs text-muted">～</span>
            <input type="date" name="to" defaultValue={sp.to ?? ''} className={sel} aria-label="迄" />
            <button type="submit" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">篩選</button>
            <Link href={href('orders')} className="text-xs text-muted hover:underline">清除</Link>
          </form>
          {showMoney ? (
            <section className="grid gap-3 sm:grid-cols-4">
              <Box label={`實付金額（${d.money.period}）`} value={money(d.money.paid)} />
              <Box label="已退款" value={money(d.money.refunded)} />
              <Box label="淨消費" value={money(d.money.net)} />
              <Box label="折抵點數" value={`${d.money.pointsUsed} 點`} />
            </section>
          ) : (
            <p className="text-xs text-muted">目前帳號沒有查看金額的權限，僅顯示訂單狀態。</p>
          )}
          <Card title={`訂單（${d.bookings.length} 筆，最多顯示 100 筆）`}>
            {d.bookings.length === 0 ? <p className="text-sm text-muted">此期間沒有訂單</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="py-1 font-medium">訂單</th><th className="py-1 font-medium">下單</th><th className="py-1 font-medium">使用日</th><th className="py-1 font-medium">內容</th><th className="py-1 font-medium">狀態</th>{showMoney && <th className="py-1 text-right font-medium">實付／退款</th>}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {d.bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="py-1.5"><Link href={`/admin/bookings?order=${b.id}`} className="font-mono text-brand-700 hover:underline">{b.code}</Link></td>
                      <td className="py-1.5 text-xs text-muted">{b.createdAt}</td>
                      <td className="py-1.5 text-xs">{b.playDate}</td>
                      <td className="py-1.5 text-xs">{[...b.courtLines, ...b.activityLines].join('；') || '—'}</td>
                      <td className="py-1.5"><Pill tone={b.status === 'PAID' || b.status === 'COMPLETED' ? 'green' : b.status === 'PENDING' ? 'amber' : 'gray'}>{BOOKING_LABEL[b.status] ?? b.status}</Pill></td>
                      {showMoney && <td className="py-1.5 text-right tabular text-xs">{money(b.total)}{b.pointsUsed > 0 && <span className="text-muted">（折 {b.pointsUsed} 點）</span>}{b.refunded > 0 && <span className="block text-muted">退 {money(b.refunded)}</span>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-4">
          <Card title={`點數餘額：${u.points} 點`}>
            <PointsPanel userId={u.id} balance={u.points} canEdit={canPoints} />
            <h3 className="mt-4 text-xs font-semibold text-muted">點數帳本（最近 100 筆）</h3>
            {d.ledger.length === 0 ? <p className="mt-1 text-sm text-muted">尚無點數異動</p> : (
              <table className="mt-1 w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1 font-medium">時間</th><th className="py-1 font-medium">類型</th><th className="py-1 font-medium">原因</th><th className="py-1 font-medium">操作者</th><th className="py-1 text-right font-medium">異動</th><th className="py-1 text-right font-medium">餘額</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {d.ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1 text-xs text-muted">{l.at}</td>
                      <td className="py-1 text-xs">{l.kind}</td>
                      <td className="py-1 text-xs">{l.reason}</td>
                      <td className="py-1 text-xs text-muted">{l.actor}</td>
                      <td className={`py-1 text-right tabular ${l.delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                      <td className="py-1 text-right tabular">{l.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="使用券（離峰券／尖峰券／通用券）">
            <VoucherIssuePanel userId={u.id} courts={d.courts} canEdit={canVoucher} />
            {d.vouchers.length === 0 ? <p className="mt-3 text-sm text-muted">沒有票券</p> : (
              <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                {d.vouchers.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs">{v.code}</span> <span className="font-medium">{v.kind}</span>
                      {v.units && <span className="text-xs text-muted">・{v.units} 小時</span>}
                      <span className="block text-[11px] text-muted">適用 {v.courts}・{v.expiresAt ? `有效至 ${v.expiresAt}` : '不限期'}・{v.createdAt}{v.issuedBy ? `・${v.issuedBy}` : ''}{v.issueReason ? `・${v.issueReason.replace(/^\[[^\]]*\]\s*/, '')}` : ''}</span>
                      {v.revokeReason && <span className="block text-[11px] text-muted">撤銷原因：{v.revokeReason}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={v.state === '可使用' ? 'green' : v.state === '已核銷' ? 'blue' : 'gray'}>{v.state}</Pill>
                      {canVoucher && v.state === '可使用' && <VoucherRevokeButton voucherId={v.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">票券在前台會員中心同步顯示；已核銷的票券保留歷史，不能撤銷。結帳時以時數券抵扣的功能將於後續階段開放。</p>
          </Card>
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="角色">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">會員</dt><dd>是（Google 登入自動建立）</dd>
              <dt className="text-muted">教練</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {u.isCoach || u.coach ? <Pill tone="violet">教練</Pill> : <span className="text-muted">否</span>}
                {u.coach && <span className="text-xs text-muted">教練名冊：{u.coach.name}（{u.coach.status === 'ACTIVE' ? '在職' : u.coach.status === 'ON_LEAVE' ? '請假' : '停用'}）</span>}
                <CoachToggle userId={u.id} isCoach={u.isCoach} canEdit={canNote} />
              </dd>
              <dt className="text-muted">後台帳號</dt>
              <dd>{u.staff ? <>{u.staff.username}・<Pill tone="blue">{u.staff.roleLabel}</Pill> {!u.staff.active && <Pill tone="gray">停用</Pill>}</> : <span className="text-muted">無（此會員沒有後台權限）</span>}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">教練身分不含後台權限。後台角色（擁有者／管理者／工作人員）在「設定管理 → 員工帳號與權限」由擁有者設定。</p>
          </Card>
          <Card title="預約資格">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">可提前預約</dt><dd>場館預設（依場館設定）</dd>
              <dt className="text-muted">可預約時段</dt><dd>場館預設</dd>
              <dt className="text-muted">可預約場地</dt><dd>{d.courts.map((c) => c.name).join('、')}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">角色預設資格與個別會員例外（提前天數、時段、尖離峰、場地、時長、同時持有筆數）將於下一階段開放設定；目前所有會員依場館預設規則，並由後端在預約與結帳時驗證。</p>
          </Card>
          <Card title="帳戶限制與黑名單" className="lg:col-span-2">
            <RestrictionPanel userId={u.id} canEdit={canRestrict} rows={d.restrictions} restricted={u.restricted} />
            <p className="mt-3 text-xs text-muted">黑名單以會員帳號（Google 身分）為準，改名或改 Email 不會解除。受限期間不能新增預約、報名、下單、使用點數或進入後台；既有已付款訂單與點數保留。解除後原有角色與資格自動恢復。</p>
          </Card>
        </div>
      )}

      {tab === 'logs' && (
        <Card title="管理紀錄（最近 100 筆）">
          {d.audit.length === 0 ? <p className="text-sm text-muted">沒有與此會員相關的管理操作</p> : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {d.audit.map((a) => (
                <li key={a.id} className="py-1.5">
                  <span className="text-xs text-muted">{a.at}</span> <span className="font-medium">{a.action}</span> <span className="text-xs text-muted">{a.actor}</span>
                  {a.detail && <span className="block break-all font-mono text-[11px] text-muted">{a.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <SourceNote source="會員、訂單、報名、點數帳本、票券與操作紀錄" basis="累計實付僅含已付款與已完成訂單；餘額以點數帳本推進" updatedAt={new Date()} />
    </div>
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-4 ${className}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  )
}

type BookingRow = Awaited<ReturnType<typeof getMemberDetail>> extends infer T ? (T extends { bookings: (infer B)[] } ? B : never) : never
type RegRow = Awaited<ReturnType<typeof getMemberDetail>> extends infer T ? (T extends { registrations: (infer R)[] } ? R : never) : never

function BookingList({ rows, showMoney, empty }: { rows: BookingRow[]; showMoney: boolean; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {rows.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            <Link href={`/admin/bookings?order=${b.id}`} className="font-mono text-brand-700 hover:underline">{b.code}</Link>
            <span className="ml-2 text-xs">{b.playDate}</span>
            <span className="block text-xs text-muted">{[...b.courtLines, ...b.activityLines].join('；') || '—'}</span>
          </span>
          <span className="flex items-center gap-2">
            <Pill tone={b.status === 'PAID' || b.status === 'COMPLETED' ? 'green' : b.status === 'PENDING' ? 'amber' : 'gray'}>{BOOKING_LABEL[b.status] ?? b.status}</Pill>
            {showMoney && <span className="tabular text-xs">{money(b.total)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RegList({ rows, empty }: { rows: RegRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            <Link href={`/admin/sessions/${r.sessionId}`} className="hover:underline">{r.date} {r.timeLabel} {r.title}</Link>
            <span className="block text-xs text-muted">{r.courts}・{r.quantity} 位</span>
          </span>
          <Pill tone={r.status === 'COMPLETED' ? 'green' : r.status === 'NO_SHOW' ? 'red' : r.status === 'CONFIRMED' ? 'blue' : 'gray'}>{r.statusLabel}</Pill>
        </li>
      ))}
    </ul>
  )
}
