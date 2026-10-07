'use client'

import { LockKeyhole } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GoogleLoginButton } from '@/components/google-button'
import { currentPath } from '@/components/auth-provider'

/** 需要登入的頁面提示；登入完成後回到原本要看的頁面 */
export function LoginPrompt({ title, description, next }: { title: string; description: string; next?: string }) {
  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardContent className="space-y-5 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
            <LockKeyhole className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
          </div>
          <GoogleLoginButton size="lg" next={next ?? (typeof window !== 'undefined' ? currentPath() : undefined)} />
          <p className="text-[11px] text-muted">登入在 Google 官方畫面完成，本站不會取得您的 Google 密碼。登入即表示您同意本平台的服務條款與隱私權政策。</p>
        </CardContent>
      </Card>
    </div>
  )
}
