'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { loginAction, type LoginState } from './actions'

export function AdminLoginForm({ lineEnabled, lineError }: { lineEnabled: boolean; lineError: string | null }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {})
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="mx-auto max-w-sm py-12 px-4">
      <Card>
        <CardContent className="space-y-5">
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <div className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-1">
              <p className="text-[11px] font-bold text-emerald-700">Pickle Heaven</p>
            </div>
            <h1 className="mt-3 text-base font-semibold">後台管理登入</h1>
            <p className="mt-1 text-xs text-muted">僅限授權的場館管理人員</p>
          </div>

          {lineError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {lineError}
            </p>
          )}

          {lineEnabled && (
            <>
              <a
                href="/api/admin/auth/line/start?intent=login"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] text-sm font-semibold text-white transition-colors hover:bg-[#05b34c]"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-white text-[10px] font-black text-[#06C755]">L</span>
                使用 LINE 登入
              </a>
              <p className="-mt-3 text-center text-[11px] text-muted">僅限已受邀並完成綁定的帳號</p>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="h-px flex-1 bg-zinc-200" />或使用帳號密碼
                <span className="h-px flex-1 bg-zinc-200" />
              </div>
            </>
          )}

          <form action={formAction} className="space-y-4">
            <Field label="帳號" required htmlFor="admin-username">
              <Input id="admin-username" name="username" autoComplete="username" required />
            </Field>
            <Field label="密碼" required htmlFor="admin-password" error={state.error}>
              <Input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
              />
            </Field>
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded"
                />
                顯示密碼
              </label>
            </div>
            <Button type="submit" block loading={pending}>
              登入
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
