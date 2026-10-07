'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MapPin,
  Phone,
  Share2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, BookingStatusBadge } from '@/components/ui/badge'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useLiff } from '@/components/liff-provider'
import { cancelMyBooking } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { REFUND_POLICY_ROWS } from '@/lib/pricing'
import { ntd } from '@/lib/utils'

interface BookingView {
  id: string
  code: string
  status: string
  playDate: string
  subtotal: number
  discount: number
  pointsUsed: number
  total: number
  contactName: string
  contactPhone: string
  note: string | null
  paidAt: string | null
  expiresAt: string | null
  venue: { name: string; address: string; phone: string; notice: string | null; policy: string | null }
  items: { courtName: string; timeLabel: string; rateName: string; price: number }[]
  payment: {
    provider: string
    method: string
    status: string
    cardLast4: string | null
    cardBrand: string | null
    providerRef: string | null
  } | null
}

export function BookingDetailClient({ booking, justCreated }: { booking: BookingView; justCreated: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const { shareBooking, inClient } = useLiff()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)

  const canCancel = booking.status === 'PAID' || booking.status === 'PENDING'

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const res = await cancelMyBooking(booking.id)
      if (res.ok) {
        setConfirmOpen(false)
        toast(
          res.refundPoints > 0
            ? `已取消預約，${res.refundPoints} 點已回補至您的帳戶`
            : '已取消預約（依政策本次不予退款）',
          'success',
        )
        router.refresh()
      } else {
        toast(res.error, 'error')
      }
    } finally {
      setCancelling(false)
    }
  }

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = `我在「${booking.venue.name}」訂了 ${formatDateFull(booking.playDate)} 的場地，一起來打球！`
    const shared = await shareBooking(text, url)
    if (!shared) {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        toast('已複製預約資訊，可直接貼給球友', 'success')
      } catch {
        toast('此環境不支援分享功能', 'info')
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Link href="/bookings" aria-label="返回列表" className="-ml-2 rounded-lg p-2 text-muted hover:surface-2">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">預約詳情</h1>
        <span className="ml-auto">
          <BookingStatusBadge status={booking.status} />
        </span>
      </div>

      {/* 成功橫幅 */}
      {justCreated && booking.status === 'PAID' && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5 dark:border-brand-800 dark:bg-brand-900/30 animate-slide-up">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">預約成功！</p>
            <p className="mt-0.5 text-xs leading-relaxed text-brand-700 dark:text-brand-300">
              預約確認訊息已發送至您的 LINE，開打前也會再提醒您一次。
            </p>
          </div>
        </div>
      )}

      {/* 待付款提醒 */}
      {booking.status === 'PENDING' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/40">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">尚未完成付款</p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              請盡快完成付款，逾時系統將自動釋放這些時段。
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link href={`/checkout/${booking.id}`}>前往付款</Link>
            </Button>
          </div>
        </div>
      )}

      {/* 報到資訊 */}
      <Card>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted">報到編號</p>
            <p className="mt-1 text-2xl font-bold tracking-[0.15em] tabular">{booking.code}</p>
            <p className="mt-1.5 text-xs text-muted">請於開打前 10 分鐘出示此編號至櫃台報到</p>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold">{formatDateFull(booking.playDate)}</p>
            <ul className="mt-2 space-y-1.5">
              {booking.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{it.courtName}</span>
                    <span className="text-muted tabular">{it.timeLabel}</span>
                    <Badge variant={it.rateName === '尖峰' ? 'peak' : 'offpeak'}>{it.rateName}</Badge>
                  </span>
                  <span className="text-muted tabular">{ntd(it.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 場館 */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">{booking.venue.name}</h2>
          <div className="space-y-2 text-xs text-muted">
            {booking.venue.address.trim() && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.venue.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 hover:text-brand-600"
            >
              <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="underline-offset-2 hover:underline">{booking.venue.address}</span>
            </a>
            )}
            {booking.venue.phone.trim() && (
            <a href={`tel:${booking.venue.phone}`} className="flex items-center gap-1.5 hover:text-brand-600">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {booking.venue.phone}
            </a>
            )}
          </div>
          {booking.venue.notice && (
            <p className="rounded-xl surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
              {booking.venue.notice}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 金額與付款 */}
      <Card>
        <CardContent className="space-y-2 text-sm">
          <h2 className="mb-1 text-sm font-semibold">付款資訊</h2>
          <Separator />
          <div className="flex justify-between pt-1">
            <span className="text-muted">小計</span>
            <span className="tabular">{ntd(booking.subtotal)}</span>
          </div>
          {booking.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">折價券</span>
              <span className="tabular text-brand-600">−{ntd(booking.discount)}</span>
            </div>
          )}
          {booking.pointsUsed > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">點數折抵</span>
              <span className="tabular text-brand-600">−{ntd(booking.pointsUsed)}</span>
            </div>
          )}
          <Separator />
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-medium">實付金額</span>
            <span className="text-xl font-bold tabular">{ntd(booking.total)}</span>
          </div>

          {booking.payment && booking.payment.status === 'SUCCESS' && (
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted">
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              {booking.payment.method === 'LINE_PAY'
                ? 'LINE Pay'
                : `${booking.payment.cardBrand ?? '信用卡'}${
                    booking.payment.cardLast4 ? ` **** ${booking.payment.cardLast4}` : ''
                  }`}
              {booking.paidAt && ` · ${new Date(booking.paidAt).toLocaleString('zh-TW', { hour12: false })}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 聯絡資訊 */}
      <Card>
        <CardContent className="space-y-2 text-sm">
          <h2 className="mb-1 text-sm font-semibold">聯絡資訊</h2>
          <Separator />
          <div className="flex justify-between pt-1">
            <span className="text-muted">聯絡人</span>
            <span>{booking.contactName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">手機</span>
            <span className="tabular">{booking.contactPhone}</span>
          </div>
          {booking.note && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-muted">備註</span>
              <span className="text-right">{booking.note}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作 */}
      <div className="flex gap-3">
        {inClient || typeof navigator !== 'undefined' ? (
          <Button variant="secondary" className="flex-1" onClick={handleShare}>
            <Share2 className="h-4 w-4" aria-hidden />
            分享
          </Button>
        ) : null}
        {canCancel && (
          <Button variant="secondary" className="flex-1 text-red-600" onClick={() => setConfirmOpen(true)}>
            取消預約
          </Button>
        )}
      </div>

      {/* 取消確認 */}
      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent title="確定要取消預約嗎？" description="取消後時段將立即釋放給其他球友，此操作無法復原。">
          <div className="space-y-4">
            <div className="rounded-xl surface-2 p-3">
              <p className="mb-2 text-xs font-medium">退款比例</p>
              <ul className="space-y-1 text-xs text-muted">
                {REFUND_POLICY_ROWS.map((row) => (
                  <li key={row.window} className="flex justify-between">
                    <span>{row.window}</span>
                    <span className="tabular">{row.ratio}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted">退款將以點數回補，可於下次預約折抵。</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>
                我再想想
              </Button>
              <Button variant="danger" className="flex-1" loading={cancelling} onClick={handleCancel}>
                確定取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
