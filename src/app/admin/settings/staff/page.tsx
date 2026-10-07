import type { Metadata } from 'next'
import { getAdminContext } from '@/lib/admin-auth'
import { can, ROLE_LABEL, ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-permissions'
import { isDemoConfigured, mainPrisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { StaffClient } from './staff-client'

export const metadata: Metadata = { title: '員工帳號與權限' }
export const dynamic = 'force-dynamic'

const PERM_LABEL: Record<string, string> = {
  dashboard: '今日總覽', ai: 'AI 助理', monitor: '場地監測', 'device.control': '設備控制', courts: '場地', 'courts.manage': '封場與場地設定',
  bookings: '交易查詢', refund: '退款', invoice: '發票', activities: '活動', members: '會員', 'members.restrict': '會員限制', marketing: '商城行銷',
  finance: '財務報表', settings: '系統設定', staff: '員工帳號', audit: '操作紀錄',
}

export default async function StaffPage() {
  const ctx = await getAdminContext()
  if (!ctx || ctx.tenant !== 'main' || !can(ctx.role, 'staff')) return <Forbidden />
  const accounts = await mainPrisma.adminAccount.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] })
  return (
    <div className="space-y-4">
      <PageTitle title="員工帳號與權限" desc="後台員工帳號（與前台會員分開管理）。權限由後端檢查，畫面只負責隱藏不可用的選單。" />
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">角色權限</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {(Object.keys(ROLE_PERMISSIONS) as AdminRole[]).map((r) => (
            <li key={r}>
              <span className="font-semibold">{ROLE_LABEL[r]}</span>：{ROLE_PERMISSIONS[r].map((p) => PERM_LABEL[p] ?? p).join('、')}
              {r === 'DEMO' && <span className="text-muted">（僅限展示資料庫，外部服務一律模擬）</span>}
            </li>
          ))}
        </ul>
      </section>
      <StaffClient
        selfId={ctx.accountId}
        isOwner={ctx.role === 'OWNER'}
        demoReady={isDemoConfigured()}
        accounts={accounts.map((a) => ({
          id: a.id,
          username: a.username,
          displayName: a.displayName,
          role: a.role,
          roleLabel: ROLE_LABEL[a.role as AdminRole] ?? a.role,
          tenant: a.tenant,
          active: a.active,
          lastLoginAt: a.lastLoginAt?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) ?? '從未登入',
        }))}
      />
      <p className="text-[11px] text-muted"><Pill>提醒</Pill> 帳號密碼以雜湊保存，系統不會顯示任何密碼。</p>
    </div>
  )
}
