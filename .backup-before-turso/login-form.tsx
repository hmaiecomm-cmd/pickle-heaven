'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function AdminLoginForm({ supabaseReady }: { supabaseReady: boolean }) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('帳號或密碼錯誤')
        return
      }
      router.replace('/admin')
      router.refresh()
    } catch {
      setError('登入失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

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

          {!supabaseReady ? (
            <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              尚未設定 Supabase 環境變數（NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY）。
              開發模式下可直接進入後台；正式環境請先完成設定並將管理者 Email 加入 ADMIN_EMAILS。
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" required htmlFor="admin-email">
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="密碼" required htmlFor="admin-password" error={error}>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button type="submit" block loading={busy}>
                登入
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
