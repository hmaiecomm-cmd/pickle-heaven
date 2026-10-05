'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useLiff } from '@/components/liff-provider'
import { joinSessionAction, cancelSessionAction } from '@/server/session-actions'

/**
 * 球敘卡片（規格 §13）。
 *
 * 刻意做得像「揪團報名」而不是訂位系統：一張卡片就看完時間、人數、價格，
 * 一顆按鈕完成動作。所有日期時間都已在伺服器端依場館時區格式化成字串再傳進來，
 * 避免瀏覽器時區與場館時區不一致。
 */

export type MyStatus = 'NONE' | 'CONFIRMED' | 'WAITLISTED'

export type SessionCardData = {
  id: string
  title: string
  dateLabel: string
  timeLabel: string
  placeLabel: string
  skillLabel: string | null
  price: number
  publicSpots: number
  reservedCapacity: number
  confirmedCount: number
  waitlistCount: number
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'warn' | 'danger' | 'brand'
  bookingOpenLabel: string
  cancelDeadlineLabel: string
  isFull: boolean
  canAct: boolean
  actionHint: string | null
  waitlistEnabled: boolean
  myStatus: MyStatus
  myWaitlistPosition: number | null
  roster: string[]
}

export function SessionCard({ data }: { data: SessionCardData }) {
  const router = useRouter()
  const { toast } = useToast()
  const { user, login, loggingIn } = useLiff()
  const [pending, startTransition] = React.useTransition()

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await action()
      toast(result.message, result.ok ? 'success' : 'error')
      if (result.ok) router.refresh()
    })
  }

  const registered = data.myStatus !== 'NONE'

  return (
    <Card>
      <CardContent className="space-y-2.5 p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">🏓 {data.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tabular-nums">
              <span>{data.dateLabel}</span>
              <span className="whitespace-nowrap">{data.timeLabel}</span>
            </p>
          </div>
          <Badge variant={data.statusTone}>{data.statusLabel}</Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
          <span>📍 {data.placeLabel}</span>
          {data.skillLabel ? <span>程度 {data.skillLabel}</span> : null}
          <span>💰 NT${data.price}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tabular-nums">
            👥 {data.confirmedCount} / {data.publicSpots}
          </span>
          {data.reservedCapacity > 0 ? (
            <span className="text-sm text-muted">另保留 {data.reservedCapacity} 席</span>
          ) : null}
        </div>

        {/* 已報名者才看得到名單，符合 §13 的畫面範例 */}
        {registered && data.roster.length > 0 ? (
          <ol className="rounded-xl surface-2 px-3 py-2 text-base leading-6">
            {data.roster.map((name, i) => (
              <li key={`${name}-${i}`} className="flex gap-2 tabular-nums">
                <span className="w-5 shrink-0 text-muted">{i + 1}</span>
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {data.myStatus === 'CONFIRMED' ? (
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">✅ 已報名</p>
        ) : null}

        {data.myStatus === 'WAITLISTED' ? (
          <div className="rounded-xl surface-2 px-3 py-2">
            <p className="text-base font-semibold">🕒 候補中</p>
            <p className="mt-0.5 text-sm text-muted">
              目前候補順位 <span className="text-base font-semibold tabular-nums">#{data.myWaitlistPosition}</span>
            </p>
          </div>
        ) : null}

        {!registered && data.isFull ? (
          <p className="text-base text-muted">
            🔴 目前已額滿
            {data.waitlistCount > 0 ? `　候補：${data.waitlistCount} 人` : ''}
          </p>
        ) : null}

        <dl className="space-y-0.5 border-t border-[rgb(var(--border))] pt-2.5 text-sm text-muted">
          <div className="flex justify-between">
            <dt>報名開放</dt>
            <dd className="tabular-nums">{data.bookingOpenLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt>取消截止</dt>
            <dd className="tabular-nums">{data.cancelDeadlineLabel}</dd>
          </div>
        </dl>

        {/* 判斷順序有意義：先處理「已報名」與「不能動作」，
            未開放的場次就不會誤導玩家先去登入。 */}
        {registered ? (
          <Button
            variant="secondary"
            block
            loading={pending}
            onClick={() => run(() => cancelSessionAction(data.id))}
          >
            {data.myStatus === 'WAITLISTED' ? '取消候補' : '取消參加'}
          </Button>
        ) : !data.canAct ? (
          <Button block disabled>
            {data.actionHint ?? '目前無法報名'}
          </Button>
        ) : !user ? (
          <Button variant="line" block loading={loggingIn} onClick={() => void login()}>
            先登入才能報名
          </Button>
        ) : (
          <Button block loading={pending} onClick={() => run(() => joinSessionAction(data.id))}>
            {data.isFull ? '加入候補' : '我要參加'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
