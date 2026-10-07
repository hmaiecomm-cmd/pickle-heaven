import type { Metadata } from 'next'
import { Lock, LockOpen } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { can, PERMISSION_LABEL, ROLE_LABEL, ROLE_PERMISSIONS, ROLE_SUMMARY, type AdminRole, type Permission } from '@/lib/admin-permissions'
import { isDemoConfigured, mainPrisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { StaffClient } from './staff-client'

export const metadata: Metadata = { title: '後台帳號與權限' }
export const dynamic = 'force-dynamic'

const MATRIX_ROLES: AdminRole[] = ['OWNER', 'MANAGER', 'STAFF']
const MATRIX_PERMS = Object.keys(PERMISSION_LABEL) as Permission[]

/**
 * 後台帳號與權限：只有擁有者（正式資料範圍）可操作。
 * 權限由後端強制；此頁的鎖頭矩陣只是說明各角色的差異。
 */
export default async function StaffPage() {
  const ctx = await getAdminContext()
  if (!ctx || ctx.tenant !== 'main' || !can(ctx.role, 'staff')) return <Forbidden />
  const [accounts, venues] = await Promise.all([
    mainPrisma.adminAccount.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] }),
    mainPrisma.venue.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const venueName = new Map(venues.map((v) => [v.id, v.name]))
  const activeOwners = accounts.filter((a) => a.role === 'OWNER' && a.active && a.tenant === 'main').length

  return (
    <div className="space-y-4">
      <PageTitle title="後台帳號與權限" desc="後台帳號與前台會員分開管理。擁有者建立帳號並指派角色；對方首次登入必須更換初始密碼。停用或變更角色會立即撤銷既有登入。" />

      <StaffClient
        selfId={ctx.accountId}
        isOwner={ctx.role === 'OWNER'}
        demoReady={isDemoConfigured()}
        activeOwners={activeOwners}
        venues={venues}
        accounts={accounts.map((a) => ({
          id: a.id,
          username: a.username,
          displayName: a.displayName,
          role: a.role,
          roleLabel: ROLE_LABEL[a.role as AdminRole] ?? a.role,
          tenant: a.tenant,
          active: a.active,
          mustChangePassword: a.mustChangePassword,
          venue: a.venueId ? venueName.get(a.venueId) ?? '（場館已移除）' : '全部場館',
          lastLoginAt: a.lastLoginAt?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) ?? '從未登入',
        }))}
      />

      <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">角色權限差異</h2>
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {MATRIX_ROLES.map((r) => (
            <li key={r}><span className="font-semibold text-[rgb(var(--fg))]">{ROLE_LABEL[r]}</span>：{ROLE_SUMMARY[r]}</li>
          ))}
        </ul>
        <table className="mt-3 w-full min-w-[32rem] text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 font-medium">功能</th>
              {MATRIX_ROLES.map((r) => <th key={r} className="py-1 text-center font-medium">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {MATRIX_PERMS.map((p) => (
              <tr key={p}>
                <td className="py-1">{PERMISSION_LABEL[p]}</td>
                {MATRIX_ROLES.map((r) => {
                  const ok = ROLE_PERMISSIONS[r].includes(p)
                  return (
                    <td key={r} className="py-1 text-center">
                      {ok ? <LockOpen className="mx-auto h-3.5 w-3.5 text-emerald-600" aria-label="可用" /> : <Lock className="mx-auto h-3.5 w-3.5 text-zinc-300" aria-label="不可用" />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted">設備控制預設只有擁有者；能看到設備狀態不代表能控制設備。帳務、退款、點數調整與金流設定只限擁有者；AI、匯出與 API 套用同一套權限。</p>
      </section>
      <p className="text-[11px] text-muted"><Pill>提醒</Pill> 密碼以雜湊保存，系統不會顯示或記錄任何密碼；既有密碼無法回看，只能重設。</p>
    </div>
  )
}
