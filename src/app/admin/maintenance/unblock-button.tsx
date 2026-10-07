'use client'

import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { unblockSlot } from '@/server/admin-actions'

export function UnblockButton({ courtId, date, start }: { courtId: string; date: string; start: number }) {
  const router = useRouter()
  const { toast } = useToast()
  return (
    <button
      type="button"
      onClick={async () => {
        if (!window.confirm('解除這個封場時段？解除後客人即可預約。')) return
        const res = await unblockSlot(courtId, date, start)
        if (!res.ok) toast(res.error, 'error')
        else {
          toast(res.message ?? '已解除', 'success')
          router.refresh()
        }
      }}
      className="h-8 rounded-lg border border-zinc-300 px-3 text-xs"
    >
      解除封場
    </button>
  )
}
