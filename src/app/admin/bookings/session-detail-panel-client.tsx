'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrderDetailPanel } from './order-detail-panel'

type Tab = 'details' | 'orders'

interface BookingItem {
  id: string
  code: string
  userName: string
  email: string | null
  phone: string | null
  total: number
  status: string
  createdAt: Date
  paymentsCount: number
  refundsCount: number
}

export function SessionDetailPanelClient({
  sessionId,
  sessionTitle,
  sessionDetailCard,
  rosterClient,
  bookings,
  perms = { refund: false, invoice: false, access: false, accessGrant: false },
}: {
  sessionId: string
  sessionTitle: string
  sessionDetailCard: React.ReactNode
  rosterClient: React.ReactNode
  bookings: BookingItem[]
  perms?: { refund: boolean; invoice: boolean; access: boolean; accessGrant: boolean }
}) {
  const [tab, setTab] = React.useState<Tab>('details')
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setIsDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => setSelectedOrderId(null), 300)
  }

  return (
    <>
      <div className="flex min-h-0 flex-col">
        {/* 頁籤 */}
        <div className="flex gap-0 border-b border-[#e3e8dc]">
          <button
            onClick={() => setTab('details')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              tab === 'details'
                ? 'border-[#1f4d34] text-[#1f4d34]'
                : 'border-transparent text-muted hover:text-[#1f2a22]'
            )}
          >
            場次詳情
          </button>
          <button
            onClick={() => setTab('orders')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              tab === 'orders'
                ? 'border-[#1f4d34] text-[#1f4d34]'
                : 'border-transparent text-muted hover:text-[#1f2a22]'
            )}
          >
            訂單列表 ({bookings.length})
          </button>
        </div>

        {/* 內容區域 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'details' ? (
            <div className="space-y-4 p-4">
              {sessionDetailCard}
              {rosterClient}
            </div>
          ) : (
            <OrdersList
              bookings={bookings}
              onViewOrder={handleViewOrder}
            />
          )}
        </div>
      </div>

      {/* 訂單詳情 Drawer */}
      <Dialog.Root open={isDrawerOpen} onOpenChange={(open) => !open && handleCloseDrawer()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-hidden border-l border-[#e3e8dc] bg-white sm:max-w-3xl flex flex-col">
            {selectedOrderId && (
              <>
                <div className="flex items-center justify-between gap-4 border-b border-[#e3e8dc] p-4 sm:p-6 shrink-0">
                  <h2 className="text-lg font-semibold text-[#1f2a22]">訂單明細</h2>
                  <Dialog.Close asChild>
                    <button
                      onClick={handleCloseDrawer}
                      className="rounded-lg p-1.5 hover:bg-zinc-100 transition-colors"
                      aria-label="關閉訂單詳情面板"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  <OrderDetailPanel
                    orderId={selectedOrderId}
                    perms={perms}
                    startWithRefund={false}
                    onBack={handleCloseDrawer}
                    onChanged={() => {}}
                  />
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function OrdersList({
  bookings,
  onViewOrder,
}: {
  bookings: BookingItem[]
  onViewOrder?: (orderId: string) => void
}) {
  return (
    <div className="p-4 space-y-2">
      {bookings.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">
          此場次沒有訂單
        </div>
      ) : (
        bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center gap-3 rounded-lg border border-[#e3e8dc] bg-white p-3 hover:bg-[#fafcf7] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm text-[#1f2a22] truncate">
                  {booking.userName}
                </span>
                {booking.email && (
                  <span className="text-xs text-muted truncate">
                    {booking.email}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-2 text-xs text-muted">
                <span>{booking.code}</span>
                <span>NT${booking.total.toLocaleString()}</span>
              </div>
            </div>
            {onViewOrder && (
              <button
                onClick={() => onViewOrder(booking.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1f4d34] px-3 text-xs font-medium text-white hover:bg-[#163a27] shrink-0 transition-colors"
                aria-label={`查看 ${booking.userName} 的訂單詳情`}
              >
                <Eye className="h-4 w-4" aria-hidden />
                查看詳情
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
