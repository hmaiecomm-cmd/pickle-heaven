'use server'

import { revalidatePath } from 'next/cache'
import { getPaymentProvider, type ChargeInstruction } from '@/lib/payments'
import { getSessionUser } from '@/lib/session'
import { createTopUpOrder, TopUpError, topUpProviders } from './topup-service'

export type TopUpActionResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string }

/**
 * 開始儲值：建立儲值單並向金流取得付款指示。
 * 只能為目前登入帳戶儲值；黑名單或受限會員由 createTopUpOrder 擋下。
 * 儲值不能用點數付款（金額固定為方案售價，無折抵）。
 */
export async function startTopUp(planId: string, providerId?: string): Promise<TopUpActionResult<{ orderId: string; code: string; instruction: ChargeInstruction }>> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: '請先登入', code: 'UNAUTHORIZED' }
    const allowed = topUpProviders()
    const chosen = allowed.find((p) => p.id === providerId) ?? allowed[0]
    if (!chosen) return { ok: false, error: '線上儲值尚未開放：場館尚未接通正式金流。', code: 'NOT_OPEN' }

    const order = await createTopUpOrder(user.id, planId)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const provider = getPaymentProvider(chosen.id)
    const instruction = await provider.createCharge({
      bookingId: order.id,
      bookingCode: order.code,
      amount: order.amount,
      description: `大新店森林匹克球 儲值點數 ${order.planName}`,
      itemNames: [`儲值 ${order.planName}：${order.points} 點${order.bonusPoints > 0 ? `＋贈 ${order.bonusPoints} 點` : ''}`],
      customer: { name: user.displayName, phone: user.phone ?? '', email: null },
      returnUrl: `${appUrl}/account/topup/${order.id}`,
      notifyUrl: `${appUrl}/api/payments/${provider.id}/notify`,
      cancelUrl: `${appUrl}/account/topup`,
    })
    revalidatePath('/account')
    return { ok: true, orderId: order.id, code: order.code, instruction }
  } catch (err) {
    if (err instanceof TopUpError) return { ok: false, error: err.message, code: err.code }
    console.error('[topup] startTopUp', err)
    return { ok: false, error: '系統忙碌中，請稍後再試' }
  }
}
