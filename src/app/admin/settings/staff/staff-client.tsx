'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { createStaffAction, resetDemoDataAction, resetStaffPasswordAction, setStaffActiveAction } from '@/server/staff-actions'

interface Account {
  id: string
  username: string
  displayName: string
  role: string
  roleLabel: string
  tenant: string
  active: boolean
  lastLoginAt: string
}

export function StaffClient({ accounts, selfId, isOwner, demoReady }: { accounts: Account[]; selfId: string; isOwner: boolean; demoReady: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = React.useState({ username: '', displayName: '', role: 'STAFF' as 'STAFF' | 'MANAGER', password: '' })
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
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold">{a.username}</span>
                <span className="ml-2 text-xs text-muted">{a.displayName}・最後登入 {a.lastLoginAt}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Pill tone={a.tenant === 'demo' ? 'amber' : 'blue'}>{a.roleLabel}{a.tenant === 'demo' ? '・展示資料' : ''}</Pill>
                <Pill tone={a.active ? 'green' : 'gray'}>{a.active ? '啟用' : '停用'}</Pill>
                {a.id !== selfId && (
                  <>
                    <button type="button" onClick={async () => done(await setStaffActiveAction(a.id, !a.active))} className="h-8 rounded-lg border border-zinc-300 px-2 text-xs">
                      {a.active ? '停用' : '啟用'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const pw = window.prompt(`為 ${a.username} 設定新密碼（至少 10 字）`)
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
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">新增員工帳號</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="帳號（英數字）" className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="帳號" />
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="顯示名稱" className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="顯示名稱" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'STAFF' })} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="角色">
            <option value="STAFF">櫃台人員</option>
            <option value="MANAGER">管理員</option>
          </select>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="初始密碼（至少 10 字）" autoComplete="new-password" className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="初始密碼" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await createStaffAction(form)
            setBusy(false)
            done(res)
            if (res.ok) setForm({ username: '', displayName: '', role: 'STAFF', password: '' })
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
