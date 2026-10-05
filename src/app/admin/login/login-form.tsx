'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { loginAction, type LoginState } from './actions'

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {})

  return (
    <div className="mx-auto max-w-sm py-12">
      <Card>
        <CardContent className="space-y-5">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-900 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-3 text-base font-semibold">後台管理登入</h1>
            <p className="mt-1 text-xs text-muted">僅限授權的場館管理人員</p>
          </div>

          <form action={formAction} className="space-y-4">
            <Field label="帳號" required htmlFor="admin-username">
              <Input id="admin-username" name="username" autoComplete="username" required />
            </Field>
            <Field label="密碼" required htmlFor="admin-password" error={state.error}>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" block loading={pending}>
              登入
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
