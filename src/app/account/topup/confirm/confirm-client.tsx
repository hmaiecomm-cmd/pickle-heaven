'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { ChargeInstruction } from '@/lib/payments'
import { ntd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { startTopUp } from '@/server/topup-actions'

interface Plan { id: string; name: string; price: number; points: number; bonusPoints: number; scopeNote: string | null; validityNote: string | null; refundNote: string | null }
interface Provider { id: string; displayName: string; method: string }

/** 步驟 2／4：確認付款金額、取得點數、付款方式與條件，再前往付款 */
export function ConfirmClient({ user, plan, providers }: { user: { name: string; points: number; restricted: boolean }; plan: Plan; providers: Provider[] }) {
  const { toast } = useToast()
  const [providerId, setProviderId] = React.useState(providers[0]?.id ?? '')
  const [agree, setAgree] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const submittedRef = React.useRef(false)

  const run = (instruction: ChargeInstruction) => {
    if (instruction.kind === 'redirect') {
      window.location.href = instruction.redirectUrl
      return
    }
    if (instruction.kind === 'form') {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = instruction.action
      for (const [k, v] of Object.entries(instruction.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      return
    }
    toast('此付款方式尚未支援儲值，請選擇其他方式', 'error')
    setBusy(false)
    submittedRef.current = false
  }

  const pay = async () => {
    if (submittedRef.current) return // 連點保護：同一次確認只會建立一張儲值單
    submittedRef.current = true
    setBusy(true)
    const res = await startTopUp(plan.id, providerId)
    if (!res.ok) {
      toast(res.error, 'error')
      setBusy(false)
      submittedRef.current = false
      return
    }
    run(res.instruction)
  }

  const total = plan.points + plan.bonusPoints
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/account/topup" className="inline-flex items-center gap-1 text-sm text-muted hover:text-[rgb(var(--fg))]">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        重新選擇方案
      </Link>
      <p className="text-xs text-muted">步驟 2／4：確認內容後前往付款。</p>
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-base font-semibold">{plan.name}</h1>
            <p className="text-xs text-muted">儲值至：{user.name}（目前登入帳戶）・目前點數 {user.points}</p>
          </div>
          <Separator />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">付款金額</dt><dd className="text-xl font-bold text-brand-600 tabular">{ntd(plan.price)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">付費點數</dt><dd className="tabular">{plan.points} 點</dd></div>
            {plan.bonusPoints > 0 && <div className="flex justify-between"><dt className="text-muted">贈送點數</dt><dd className="tabular">{plan.bonusPoints} 點（另記一筆）</dd></div>}
            <div className="flex justify-between font-semibold"><dt>入帳後取得</dt><dd className="tabular">{total} 點</dd></div>
            <div className="flex justify-between"><dt className="text-muted">儲值後餘額（預計）</dt><dd className="tabular">{user.points + total} 點</dd></div>
          </dl>
          <Separator />
          <div className="space-y-1 text-xs text-muted">
            <p>使用範圍：{plan.scopeNote ?? '依場館規定，可於結帳時折抵。'}</p>
            <p>效期：{plan.validityNote ?? '依場館規定。'}</p>
            <p>退款：{plan.refundNote ?? '依場館規定；已使用的點數不退。'}</p>
            <p>點數儲值不能使用點數或折價券付款；付款由金流確認後才入帳，返回頁面不代表已付款。</p>
          </div>
          <Separator />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">付款方式</legend>
            {providers.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-3 py-2 text-sm">
                <input type="radio" name="provider" value={p.id} checked={providerId === p.id} onChange={() => setProviderId(p.id)} />
                {p.displayName}
                {p.id === 'mock' && <span className="text-xs text-amber-700">（測試環境，不會實際扣款）</span>}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            我已確認儲值對象為目前登入帳戶，並了解上述使用範圍、效期與退款條件。
          </label>
          <Button block size="lg" loading={busy} disabled={!agree || user.restricted || !providerId} onClick={pay}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            前往付款 {ntd(plan.price)}
          </Button>
          {user.restricted && <p className="text-xs text-amber-800">此帳戶目前限制使用，無法新增儲值。</p>}
        </CardContent>
      </Card>
    </div>
  )
}
