import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import {
  ACTION_LABEL,
  ACTION_MEANING,
  MATRIX_ROLES,
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABEL,
  ROLE_LABEL,
  ROLE_MATRIX,
  ROLE_SUMMARY,
  can,
  canDo,
  type AdminRole,
} from '@/lib/admin-permissions'
import { isDemoConfigured, mainPrisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { StaffClient } from './staff-client'

export const metadata: Metadata = { title: '後台帳號與權限' }
export const dynamic = 'force-dynamic'


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
        <h2 className="text-sm font-semibold">管理權限設定（角色與權限）</h2>
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {MATRIX_ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold text-[rgb(var(--fg))]">{ROLE_LABEL[r]}</span>：{ROLE_SUMMARY[r]}
            </li>
          ))}
        </ul>
        <table className="mt-3 w-full min-w-[40rem] text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-2 font-medium">角色</th>
              {MODULES.map((m) => (
                <th key={m} className="py-2 text-center font-medium">
                  {MODULE_LABEL[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {MATRIX_ROLES.map((r) => (
              <tr key={r}>
                <td className="py-2 font-semibold">{ROLE_LABEL[r]}</td>
                {MODULES.map((m) => {
                  const granted = ROLE_MATRIX[r][m] ?? []
                  const full = granted.length === MODULE_ACTIONS[m].length
                  return (
                    <td key={m} className="py-2 text-center align-top">
                      {granted.length === 0 ? (
                        <Minus className="mx-auto h-3.5 w-3.5 text-zinc-300" aria-label="無權限" />
                      ) : full ? (
                        <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white" aria-label="完整權限">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="text-[11px] leading-tight text-emerald-800">{granted.map((a) => ACTION_LABEL[a]).join('・')}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-[#2f7d3b]">查看每個動作的細項（查看、新增、編輯、刪除、審核、匯出、遠端控制、門禁授權）</summary>
          <table className="mt-2 w-full min-w-[40rem] text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">模組／動作</th>
                {MATRIX_ROLES.map((r) => (
                  <th key={r} className="py-1 text-center font-medium">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {MODULES.flatMap((m) =>
                MODULE_ACTIONS[m].map((a) => (
                  <tr key={`${m}.${a}`}>
                    <td className="py-1">
                      {MODULE_LABEL[m]}・{ACTION_LABEL[a]}
                      {ACTION_MEANING[`${m}.${a}`] && <span className="ml-1 text-muted">（{ACTION_MEANING[`${m}.${a}`]}）</span>}
                    </td>
                    {MATRIX_ROLES.map((r) => (
                      <td key={r} className="py-1 text-center">
                        {canDo(r, m, a) ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" aria-label="可用" /> : <Minus className="mx-auto h-3.5 w-3.5 text-zinc-300" aria-label="不可用" />}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
        <p className="mt-2 text-[11px] text-muted">
          權限一律在後端檢查（頁面、API、AI 助理套用同一份設定）。管理員邀請與角色變更只限擁有者；看得到設備狀態不代表能控制設備。
        </p>
      </section>
      <p className="text-[11px] text-muted"><Pill>提醒</Pill> 密碼以雜湊保存，系統不會顯示或記錄任何密碼；既有密碼無法回看，只能重設。</p>
    </div>
  )
}
