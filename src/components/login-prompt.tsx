'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLiff } from '@/components/liff-provider'

export function LoginPrompt({ title, description }: { title: string; description: string }) {
  const { login, loggingIn, error } = useLiff()

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardContent className="space-y-5 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#06C755]/10 text-[#06C755]">
            <MessageCircle className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
          </div>
          <Button block size="lg" variant="line" onClick={login} loading={loggingIn}>
            使用 LINE 登入
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-muted">登入即表示您同意本平台的服務條款與隱私權政策。</p>
        </CardContent>
      </Card>
    </div>
  )
}
