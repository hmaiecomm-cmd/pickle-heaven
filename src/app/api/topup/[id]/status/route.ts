import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { linepayProvider } from '@/lib/payments'
import { expireStaleTopUps, markTopUpPaid, recordTopUpFailure } from '@/server/topup-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 儲值單狀態（返回頁輪詢用）。只回傳本人的儲值單。
 * 返回頁不憑參數加點：LINE Pay 導回時由這裡呼叫 Confirm API 向金流商確認後才入點。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  await expireStaleTopUps()
  const order = await prisma.topUpOrder.findUnique({ where: { id }, select: { id: true, userId: true, status: true, amount: true, points: true, bonusPoints: true, failReason: true } })
  if (!order || order.userId !== user.id) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const transactionId = new URL(req.url).searchParams.get('transactionId')
  if (transactionId && order.status === 'PENDING') {
    try {
      const result = await linepayProvider.confirm!({ transactionId, amount: String(order.amount) })
      if (result.ok) {
        await markTopUpPaid(order.id, { provider: 'linepay', method: 'LINE_PAY', amount: order.amount, providerRef: result.providerRef, raw: result.raw })
      } else {
        await recordTopUpFailure(order.id, 'linepay', result.failReason ?? '付款失敗', result.raw)
      }
    } catch (err) {
      console.error('[linepay] 儲值 confirm 失敗', err)
    }
  }

  const fresh = await prisma.topUpOrder.findUnique({ where: { id }, select: { status: true, failReason: true } })
  const balance = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } })
  return NextResponse.json({ status: fresh?.status ?? order.status, failReason: fresh?.failReason ?? null, points: balance?.points ?? user.points })
}
