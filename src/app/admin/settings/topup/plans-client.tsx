'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { savePlanAction, setPlanActiveAction } from '@/server/topup-admin-actions'

interface Plan { id: string; name: string; price: number; points: number; bonusPoints: number; scopeNote: string | null; validityNote: string | null; refundNote: string | null; active: boolean; sortOrder: number; sold: number }

const empty = { id: null as string | null, name: '', price: 1000, points: 1000, bonusPoints: 0, scopeNote: '', validityNote: '', refundNote: '', active: false, sortOrder: 0 }
const input = 'h-9 w-full rounded-lg border border-zinc-300 px-2 text-sm'

export function PlansClient({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = React.useState(empty)
  const [busy, setBusy] = React.useState(false)
  const editing = Boolean(form.id)

  const save = async () => {
    setBusy(true)
    const res = await savePlanAction({ ...form, price: Number(form.price), points: Number(form.points), bonusPoints: Number(form.bonusPoints), sortOrder: Number(form.sortOrder), scopeNote: form.scopeNote || null, validityNote: form.validityNote || null, refundNote: form.refundNote || null })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.message ?? '完成', 'success')
    setForm(empty)
    router.refresh()
  }

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-100 text-sm">
          {plans.length === 0 && <li className="p-6 text-center text-muted">尚未建立儲值方案。建立並上架後，前台「儲值點數」才會顯示。</li>}
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold">{p.name}</span>
                <span className="ml-2 text-xs text-muted">NT${p.price.toLocaleString()} → {p.points} 點{p.bonusPoints > 0 ? `＋贈 ${p.bonusPoints}` : ''}・已售 {p.sold} 筆・排序 {p.sortOrder}</span>
                {(p.scopeNote || p.validityNote || p.refundNote) && <span className="block text-[11px] text-muted">{[p.scopeNote, p.validityNote, p.refundNote].filter(Boolean).join('／')}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Pill tone={p.active ? 'green' : 'gray'}>{p.active ? '上架中' : '未上架'}</Pill>
                <button type="button" onClick={() => setForm({ id: p.id, name: p.name, price: p.price, points: p.points, bonusPoints: p.bonusPoints, scopeNote: p.scopeNote ?? '', validityNote: p.validityNote ?? '', refundNote: p.refundNote ?? '', active: p.active, sortOrder: p.sortOrder })} className="h-8 rounded-lg border border-zinc-300 px-2 text-xs">編輯</button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await setPlanActiveAction(p.id, !p.active)
                    if (!res.ok) return toast(res.error, 'error')
                    toast(res.message ?? '完成', 'success')
                    router.refresh()
                  }}
                  className="h-8 rounded-lg border border-zinc-300 px-2 text-xs"
                >
                  {p.active ? '下架' : '上架'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">{editing ? `編輯方案：${form.name}` : '新增儲值方案'}</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          <label className="text-xs text-muted">名稱<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} aria-label="方案名稱" /></label>
          <label className="text-xs text-muted">支付金額（元）<input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={input} aria-label="支付金額" /></label>
          <label className="text-xs text-muted">購買點數<input type="number" min={1} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} className={input} aria-label="購買點數" /></label>
          <label className="text-xs text-muted">贈送點數<input type="number" min={0} value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: Number(e.target.value) })} className={input} aria-label="贈送點數" /></label>
          <label className="text-xs text-muted">排序<input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className={input} aria-label="排序" /></label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-muted">使用範圍<input value={form.scopeNote} onChange={(e) => setForm({ ...form, scopeNote: e.target.value })} placeholder="例：場地租借與活動報名結帳折抵" className={input} aria-label="使用範圍" /></label>
          <label className="text-xs text-muted">效期<input value={form.validityNote} onChange={(e) => setForm({ ...form, validityNote: e.target.value })} placeholder="例：入帳後 12 個月" className={input} aria-label="效期" /></label>
          <label className="text-xs text-muted">退款說明<input value={form.refundNote} onChange={(e) => setForm({ ...form, refundNote: e.target.value })} placeholder="例：未使用之付費點數可申請退款，贈點不退" className={input} aria-label="退款說明" /></label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          上架（前台可見）
        </label>
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy || !form.name.trim()} onClick={save} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40">{editing ? '儲存變更' : '建立方案'}</button>
          {editing && <button type="button" onClick={() => setForm(empty)} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm">取消編輯</button>}
        </div>
      </section>
    </>
  )
}
