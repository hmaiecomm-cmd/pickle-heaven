'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { loginAction, type LoginState } from './actions'

const LINE_CLIENT_ID = process.env.NEXT_PUBLIC_LINE_CLIENT_ID || 'DEMO_LINE_CLIENT_ID'
const LINE_REDIRECT_URI = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/auth/line/callback`

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {})
  const [showPassword, setShowPassword] = React.useState(false)

  const handleLineLogin = () => {
    const state = Math.random().toString(36).substring(2, 15)
    const nonce = Math.random().toString(36).substring(2, 15)

    // 保存 state 和 nonce 到 localStorage（實際應使用 secure session）
    if (typeof window !== 'undefined') {
      localStorage.setItem('line_auth_state', state)
      localStorage.setItem('line_auth_nonce', nonce)
    }

    const lineAuthUrl = new URL('https://web.line.me/web/login')
    lineAuthUrl.searchParams.set('response_type', 'code')
    lineAuthUrl.searchParams.set('client_id', LINE_CLIENT_ID)
    lineAuthUrl.searchParams.set('redirect_uri', LINE_REDIRECT_URI)
    lineAuthUrl.searchParams.set('state', state)
    lineAuthUrl.searchParams.set('nonce', nonce)
    lineAuthUrl.searchParams.set('scope', 'openid profile email')
    lineAuthUrl.searchParams.set('prompt', 'consent')

    window.location.href = lineAuthUrl.toString()
  }

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

          {/* LINE 登入 */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleLineLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00B900] hover:bg-[#009900] text-white px-4 py-2.5 font-semibold text-sm transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              使用 LINE 登入
            </button>
            <p className="text-center text-[11px] text-muted">
              使用 LINE 帳號快速驗證身份
            </p>
          </div>

          {/* 分隔線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-muted">或</span>
            </div>
          </div>

          {/* 帳號密碼登入 */}
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
              使用帳號登入
            </Button>
          </form>

          {/* Demo 模式提示 */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-[11px] text-amber-700">
              <strong>Demo 模式：</strong> 使用帳號 <code className="bg-white px-1">admin</code> 和任意密碼登入
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
