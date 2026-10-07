'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { createStaffAction, resetDemoDataAction, resetStaffPasswordAction, setStaffActiveAction, setStaffRoleAction } from '@/server/staff-actions'

interface Account {
  id: string
  username: string
  displayName: string
  role: string
  roleLabel: string
  tenant: string
  active: boolean
  mustChangePassword: boolean
  venue: string
  lastLoginAt: string
}

const input = 'h-10 rounded-lg border border-zinc-300 px-2 text-sm'

export function StaffClient({ accounts, selfId, isOwner, demoReady, activeOwners, venues }: { accounts: Account[]; selfId: string; isOwner: boolean; demoReady: boolean; activeOwners: number; venues: { id: string; name: string }[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = React.useState({ username: '', displayName: '', role: 'STAFF' as 'STAFF' | 'MANAGER', password: '', venueId: venues[0]?.id ?? '' })
  const [busy, setBusy] = React.useState(false)

  const done = (res: { ok: boolean; message?: string; error?: string }) => {
    if (!res.ok) toast(res.error ?? '操作失敗', 'error')
    else {
      if (res.message) toast(res.message, 'success')
      router.refresh()
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-100 text-sm">
          {accounts.map((a) => {
            const lastOwner = a.role === 'OWNER' && a.active && activeOwners <= 1
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-semibold">{a.username}</span>
                  {a.id === selfId && <span className="ml-1 text-xs text-muted">（本人）</span>}
                  <span className="ml-2 text-xs text-muted">{a.displayName}・{a.venue}・最後登入 {a.lastLoginAt}</span>
                  {a.mustChangePassword && <span className="ml-2 text-xs text-amber-700">待首次登入更換密碼</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {a.tenant === 'demo' ? (
                    <Pill tone="amber">{a.roleLabel}・展示資料</Pill>
                  ) : isOwner && a.id !== selfId ? (
                    <select
                      value={a.role}
                      onChange={async (e) => {
                        const role = e.target.value as 'OWNER' | 'MANAGER' | 'STAFF'
                        if (!window.confirm(`將 ${a.username} 的角色改為「${{ OWNER: '擁有者', MANAGER: '管理員', STAFF: '工作人員' }[role]}」？對方既有登入會立即失效。`)) return
                        done(await setStaffRoleAction(a.id, role))
                      }}
                      disabled={lastOwner}
                      title={lastOwner ? '最後一位有效擁有者不能降權' : '指派角色'}
                      className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-60"
                      aria-label={`${a.username} 的角色`}
                    >
                      <option value="OWNER">擁有者</option>
                      <option value="MANAGER">管理員</option>
                      <option value="STAFF">工作人員</option>
                    </select>
                  ) : (
                    <Pill tone="blue">{a.roleLabel}</Pill>
                  )}
                  <Pill tone={a.active ? 'green' : 'gray'}>{a.active ? '啟用' : '停用'}</Pill>
                  {a.id !== selfId && a.tenant !== 'demo' && (
                    <>
                      <button
                        type="button"
                        disabled={a.active && lastOwner}
                        title={a.active && lastOwner ? '最後一位有效擁有者不能停用' : undefined}
                        onClick={async () => {
                          if (a.active && !window.confirm(`停用 ${a.username}？對方的登入會立即失效。`)) return
                          done(await setStaffActiveAction(a.id, !a.active))
                        }}
                        className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-40"
                      >
                        {a.active ? '停用' : '啟用'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const pw = window.prompt(`為 ${a.username} 設定新的初始密碼（至少 10 字）。對方下次登入必須更換。`)
                          if (pw) done(await resetStaffPasswordAction(a.id, pw))
                        }}
                        className="h-8 rounded-lg border border-zinc-300 px-2 text-xs"
                      >
                        重設密碼
                      </button>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">新增後台帳號</h2>
        <p className="text-xs text-muted">可建立管理員或工作人員。擁有者只能由既有擁有者在上方列表轉移。</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="登入帳號（英數字）" className={input} aria-label="登入帳號" />
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="顯示名稱" className={input} aria-label="顯示名稱" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'STAFF' })} className={input} aria-label="角色">
            <option value="STAFF">工作人員</option>
            <option value="MANAGER">管理員</option>
          </select>
          <select value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} className={input} aria-label="授權場館">
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            <option value="">全部場館</option>
          </select>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="初始密碼（至少 10 字）" autoComplete="new-password" className={input} aria-label="初始密碼" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await createStaffAction({ ...form, venueId: form.venueId || null })
            setBusy(false)
            done(res)
            if (res.ok) setForm({ ...form, username: '', displayName: '', password: '' })
          }}
          className="mt-2 h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          建立帳號
        </button>
      </section>

      {isOwner && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h2 className="font-semibold text-amber-900">展示資料</h2>
          <p className="mt-1 text-amber-900">展示帳號 DEMO 只能讀寫獨立的展示資料庫。重置會清空展示資料並重新產生虛構資料，不會影響正式資料。</p>
          <button
            type="button"
            disabled={!demoReady || busy}
            onClick={async () => {
              if (!window.confirm('確定重置展示資料？展示帳號會被登出。')) return
              setBusy(true)
              const res = await resetDemoDataAction()
              setBusy(false)
              done(res)
            }}
            className="mt-2 h-10 rounded-lg border border-amber-400 bg-white px-4 font-semibold text-amber-900 disabled:opacity-40"
          >
            {demoReady ? '重置展示資料' : '展示資料庫尚未設定'}
          </button>
        </section>
      )}
    </>
  )
}
