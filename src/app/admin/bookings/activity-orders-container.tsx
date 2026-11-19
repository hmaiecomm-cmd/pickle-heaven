'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { ActivityOrders } from './activity-orders'
import type { ActivityOrderFilters, ActivityOrderRow, ActivityOrderStats } from '@/server/activity-orders-admin'

export function ActivityOrdersContainer({
  stats,
  rows,
  total,
  pages,
  filters,
  range,
  canDetail,
  sessionDetail,
}: {
  stats: ActivityOrderStats
  rows: ActivityOrderRow[]
  total: number
  pages: number
  filters: ActivityOrderFilters
  range: { from: string; to: string }
  canDetail: boolean
  sessionDetail?: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedSessionId = searchParams.get('session')
  const [isOpen, setIsOpen] = React.useState(!!selectedSessionId)

  React.useEffect(() => {
    setIsOpen(!!selectedSessionId)
  }, [selectedSessionId])

  const handleClose = () => {
    setIsOpen(false)
    // 移除 URL 參數
    const params = new URLSearchParams(searchParams)
    params.delete('session')
    const newUrl = params.toString() ? `/admin/bookings?${params}` : '/admin/bookings?tab=activity'
    router.push(newUrl)
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <div className="space-y-5">
        <ActivityOrders stats={stats} rows={rows} total={total} pages={pages} filters={filters} range={range} canDetail={canDetail} />

        {sessionDetail && (
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-[#e3e8dc] bg-white sm:max-w-3xl">
              <div className="space-y-4 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-[#1f2a22]">場次詳情</h2>
                  <Dialog.Close asChild>
                    <button
                      onClick={handleClose}
                      className="rounded-lg p-1.5 hover:bg-zinc-100"
                      aria-label="關閉詳情面板"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>

                {sessionDetail}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </div>
    </Dialog.Root>
  )
}
