'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { archiveActivityAction } from '@/server/activity-admin-actions'

/** 下架活動（草稿則刪除）。有報名的場次需先逐場取消，才會允許下架。 */
export function ArchiveButton({ id, draft, disabled }: { id: string; draft: boolean; disabled: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled || busy}
      onClick={async () => {
        if (!window.confirm(draft ? '刪除這個草稿？保留的場地會一併釋放。' : '下架這個活動？未來沒有報名的場次會取消並釋放場地。')) return
        setBusy(true)
        try {
          const res = await archiveActivityAction(id)
          toast(res.message ?? '', res.ok ? 'success' : 'error')
          if (res.ok) router.push('/admin/activities')
        } finally {
          setBusy(false)
        }
      }}
    >
      {draft ? '刪除草稿' : '下架活動'}
    </Button>
  )
}
