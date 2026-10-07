'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { changeOwnPasswordAction } from '@/server/staff-actions'

export function ChangePasswordForm({ forced, username }: { forced: boolean; username: string }) {
  const router = useRouter()
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [again, setAgain] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 10) return setError('新密碼至少 10 個字')
    if (next !== again) return setError('兩次輸入的新密碼不一致')
    setPending(true)
    const res = await changeOwnPasswordAction({ current, next })
    setPending(false)
    if (!res.ok) return setError(res.error)
    router.replace('/admin')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <Card>
        <CardContent className="space-y-5">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-white">
              <KeyRound className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-3 text-base font-semibold">{forced ? '首次登入，請更換密碼' : '更換密碼'}</h1>
            <p className="mt-1 text-xs text-muted">{forced ? `帳號 ${username} 使用的是擁有者設定的初始密碼，更換後才能使用後台。` : `帳號 ${username}`}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="目前密碼" required htmlFor="pw-current">
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="新密碼（至少 10 個字）" required htmlFor="pw-next">
              <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
            </Field>
            <Field label="再輸入一次新密碼" required htmlFor="pw-again" error={error ?? undefined}>
              <Input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={10} />
            </Field>
            <Button type="submit" block loading={pending}>更換密碼</Button>
          </form>
          <p className="text-[11px] text-muted">更換後其他裝置的登入會被登出。密碼以雜湊保存，系統不會記錄明文。</p>
        </CardContent>
      </Card>
    </div>
  )
}
