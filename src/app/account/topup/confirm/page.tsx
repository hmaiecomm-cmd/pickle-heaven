import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser, SessionUnavailableError } from '@/lib/session'
import { prisma } from '@/lib/db'
import { brand } from '@/config/site'
import { LoginPrompt } from '@/components/login-prompt'
import { topUpAvailability, topUpProviders } from '@/server/topup-service'
import { ConfirmClient } from './confirm-client'

export const metadata: Metadata = { title: '確認儲值' }
export const dynamic = 'force-dynamic'

export default async function TopUpConfirmPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planId } = await searchParams
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (err) {
    if (err instanceof SessionUnavailableError) return <p className="py-10 text-center text-sm text-muted">目前暫時無法確認登入狀態，請稍後再試。</p>
    throw err
  }
  if (!user) return <LoginPrompt title={`登入${brand.name}`} description="登入後可為目前帳戶儲值點數。" next={`/account/topup/confirm?plan=${planId ?? ''}`} />
  if (!topUpAvailability().open) redirect('/account/topup')
  if (!planId) redirect('/account/topup')
  const plan = await prisma.topUpPlan.findUnique({ where: { id: planId } })
  if (!plan || !plan.active) notFound()

  return (
    <ConfirmClient
      user={{ name: user.displayName, points: user.points, restricted: user.restricted }}
      plan={{ id: plan.id, name: plan.name, price: plan.price, points: plan.points, bonusPoints: plan.bonusPoints, scopeNote: plan.scopeNote, validityNote: plan.validityNote, refundNote: plan.refundNote }}
      providers={topUpProviders()}
    />
  )
}
