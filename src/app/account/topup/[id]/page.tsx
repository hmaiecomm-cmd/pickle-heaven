import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser, SessionUnavailableError } from '@/lib/session'
import { prisma } from '@/lib/db'
import { brand } from '@/config/site'
import { LoginPrompt } from '@/components/login-prompt'
import { expireStaleTopUps } from '@/server/topup-service'
import { TopUpStatusClient } from './status-client'

export const metadata: Metadata = { title: '儲值結果' }
export const dynamic = 'force-dynamic'

/** 步驟 3／4：等待付款確認（由後端查詢金流狀態），步驟 4：入帳後查看交易紀錄 */
export default async function TopUpStatusPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ transactionId?: string }> }) {
  const { id } = await params
  const { transactionId } = await searchParams
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (err) {
    if (err instanceof SessionUnavailableError) return <p className="py-10 text-center text-sm text-muted">目前暫時無法確認登入狀態，請稍後再試。</p>
    throw err
  }
  if (!user) return <LoginPrompt title={`登入${brand.name}`} description="登入後查看儲值結果。" next={`/account/topup/${id}`} />
  await expireStaleTopUps()
  const order = await prisma.topUpOrder.findUnique({ where: { id } })
  if (!order || order.userId !== user.id) notFound()

  return (
    <TopUpStatusClient
      order={{ id: order.id, code: order.code, planName: order.planName, amount: order.amount, points: order.points, bonusPoints: order.bonusPoints, status: order.status, failReason: order.failReason, createdAt: order.createdAt.toISOString() }}
      initialPoints={user.points}
      transactionId={transactionId ?? null}
    />
  )
}
