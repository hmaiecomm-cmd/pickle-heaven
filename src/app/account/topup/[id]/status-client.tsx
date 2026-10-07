'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Loader2, TriangleAlert, XCircle } from 'lucide-react'
import { ntd } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Separator } from '@/components/ui/card'

interface Order { id: string; code: string; planName: string; amount: number; points: number; bonusPoints: number; status: string; failReason: string | null; createdAt: string }

const POLL_MS = 3000
const MAX_POLLS = 40

/**
 * 儲值結果頁。狀態一律向後端查詢（/api/topup/[id]/status），不憑網址參數判定已付款；
 * 金流確認延遲時顯示「付款確認中」並提供查詢入口；重整或重開不會重複入點。
 */
export function TopUpStatusClient({ order, initialPoints, transactionId }: { order: Order; initialPoints: number; transactionId: string | null }) {
  const [status, setStatus] = React.useState(order.status)
  const [failReason, setFailReason] = React.useState(order.failReason)
  const [points, setPoints] = React.useState(initialPoints)
  const [polls, setPolls] = React.useState(0)
  const [checking, setChecking] = React.useState(false)
  const done = ['CREDITED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(status)

  const check = React.useCallback(async () => {
    setChecking(true)
    try {
      const url = transactionId ? `/api/topup/${order.id}/status?transactionId=${encodeURIComponent(transactionId)}` : `/api/topup/${order.id}/status`
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { status: string; failReason: string | null; points: number }
        setStatus(data.status)
        setFailReason(data.failReason)
        setPoints(data.points)
      }
    } catch {
      /* 網路暫時失敗：下一輪再查 */
    } finally {
      setChecking(false)
      setPolls((n) => n + 1)
    }
  }, [order.id, transactionId])

  React.useEffect(() => {
    if (done || polls >= MAX_POLLS) return
    const t = setTimeout(check, polls === 0 ? 300 : POLL_MS)
    return () => clearTimeout(t)
  }, [check, done, polls])

  const total = order.points + order.bonusPoints
  const view =
    status === 'CREDITED'
      ? { icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />, title: '儲值完成，點數已入帳', desc: `已入帳 ${order.points} 點${order.bonusPoints > 0 ? `＋贈 ${order.bonusPoints} 點` : ''}，目前可用點數 ${points} 點。`, tone: 'ok' as const }
      : status === 'PAID' || status === 'CREDIT_FAILED'
        ? { icon: <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden />, title: '付款已確認，點數入帳中', desc: status === 'CREDIT_FAILED' ? '款項已收到，點數入帳正在處理中，場館會為您補入；請不要再次付款。' : '款項已收到，正在把點數記入您的帳戶。', tone: 'wait' as const }
        : status === 'PENDING'
          ? { icon: <Clock className="h-6 w-6 text-amber-600" aria-hidden />, title: polls >= MAX_POLLS ? '尚未收到付款確認' : '付款確認中', desc: '我們正在向金流商確認付款結果。若您已完成付款，請勿重複付款；可稍後再回到「我的點數」查看。', tone: 'wait' as const }
          : { icon: <XCircle className="h-6 w-6 text-red-600" aria-hidden />, title: status === 'EXPIRED' ? '儲值單已逾時' : '付款未完成', desc: failReason ?? '這次付款沒有成功，您的帳戶未被扣款或將由金流商退回。可重新選擇方案再試一次。', tone: 'fail' as const }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <p className="text-xs text-muted">{status === 'CREDITED' ? '步驟 4／4：完成' : '步驟 3／4：等待付款確認'}</p>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            {view.icon}
            <div>
              <h1 className="text-base font-semibold">{view.title}</h1>
              <p className="mt-1 text-sm text-muted">{view.desc}</p>
            </div>
          </div>
          <Separator />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">儲值單號</dt><dd className="tabular">{order.code}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">方案</dt><dd>{order.planName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">付款金額</dt><dd className="tabular">{ntd(order.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">取得點數</dt><dd className="tabular">{total} 點{order.bonusPoints > 0 && <span className="text-xs text-muted">（付費 {order.points}＋贈 {order.bonusPoints}）</span>}</dd></div>
          </dl>
          {view.tone === 'wait' && (
            <Button block variant="secondary" loading={checking} onClick={check}>重新查詢付款狀態</Button>
          )}
          {view.tone === 'ok' && (
            <Button asChild block>
              <Link href="/account?tab=points">查看交易紀錄</Link>
            </Button>
          )}
          {view.tone === 'fail' && (
            <Button asChild block>
              <Link href="/account/topup">重新儲值</Link>
            </Button>
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-muted">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            付款結果以場館系統向金流商確認為準；若已付款但點數未增加，請保留儲值單號聯絡場館，不需要再付款一次。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
