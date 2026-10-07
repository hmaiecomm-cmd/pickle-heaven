import type {
  CallbackResult,
  ChargeContext,
  ChargeInstruction,
  PaymentProvider,
  RefundResult,
} from './types'

/**
 * 開發用模擬金流。
 * 導向站內的 /checkout/simulator 頁面，可手動選擇付款成功或失敗，
 * 用來完整走完「結帳 → 付款 → 回呼 → 訂單成立 → LINE 通知」流程，
 * 無需申請任何金流商帳號。正式環境請改用 tappay / newebpay / linepay。
 */
export const mockProvider: PaymentProvider = {
  id: 'mock',
  displayName: '測試信用卡（模擬）',
  method: 'CREDIT_CARD',

  isConfigured: () => true,

  async createCharge(ctx: ChargeContext): Promise<ChargeInstruction> {
    const providerRef = `MOCK${Date.now()}${Math.floor(Math.random() * 1000)}`
    const url = new URL('/checkout/simulator', ctx.returnUrl)
    url.searchParams.set('ref', providerRef)
    url.searchParams.set('code', ctx.bookingCode)
    url.searchParams.set('booking', ctx.bookingId)
    url.searchParams.set('amount', String(ctx.amount))
    url.searchParams.set('return', ctx.returnUrl)
    return { kind: 'redirect', providerRef, redirectUrl: url.toString() }
  },

  async handleCallback(req: Request): Promise<CallbackResult> {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const success = body.result === 'success'
    return {
      ok: success,
      providerRef: String(body.ref ?? ''),
      bookingCode: String(body.code ?? ''),
      amount: Number(body.amount ?? 0),
      cardLast4: success ? '4242' : null,
      cardBrand: success ? 'VISA' : null,
      failReason: success ? undefined : '模擬付款失敗（卡片遭拒）',
      raw: body,
      ack: { body: 'OK', contentType: 'text/plain' },
    }
  },

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    console.info('[mock] 模擬退款', { providerRef, amount })
    return { ok: true, providerRef: `${providerRef}-REFUND` }
  },
}
