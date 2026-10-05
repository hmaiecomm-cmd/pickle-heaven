'use client'

import * as React from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error('[app] 未處理的錯誤', error)
  }, [error])

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/50">
        <CircleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold">系統暫時發生問題</h1>
      <p className="mt-1.5 text-sm text-muted">請稍後再試，若持續發生請聯絡場館櫃台。</p>
      {error.digest && <p className="mt-2 text-[11px] text-muted tabular">錯誤代碼：{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        重新載入
      </Button>
    </div>
  )
}
