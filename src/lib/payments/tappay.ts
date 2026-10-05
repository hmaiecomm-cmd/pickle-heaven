import type {
  CallbackResult,
  ChargeContext,
  ChargeInstruction,
  PaymentProvider,
  RefundResult,
} from './types'
import { PaymentError, scrubSensitive } from './types'

/**
 * TapPay 信用卡（Pay by Prime）。
 *
 * 收單流程：
 *  1. 前端載入 TapPay SDK，以 TPDirect.card.setup() 掛載 Fields（卡號輸入框由 TapPay 的 iframe 代管）。
 *  2. 前端呼叫 TPDirect.card.getPrime() 取得一次性 prime token。
 *  3. 前端把 prime 送到 /api/payments/tappay/prime，由本模組向 TapPay 請款。
 *
 * 卡號、有效期限、CVV 全程僅存在於 TapPay 的 iframe 內，
 * 不會進入我方前端 DOM、不會送到我方伺服器，也不會寫入資料庫。
 */

function endpoints() {
  const prod = process.env.NEXT_PUBLIC_TAPPAY_SERVER_TYPE === 'production'
  const base = prod ? 'https://prod.tappay.com' : 'https://sandbox.tappay.tw'
  return {
    payByPrime: `${base}/tpc/payment/pay-by-prime`,
    refund: `${base}/tpc/transaction/refund`,
  }
}

interface TapPayResponse {
  status: number
  msg: string
  rec_trade_id?: string
  bank_transaction_id?: string
  amount?: number
  card_info?: { last_four?: string; issuer?: string; type?: number; bin_code?: string }
}

const CARD_TYPE: Record<number, string> = { 1: 'VISA', 2: 'MasterCard', 3: 'JCB', 4: 'Union Pay', 5: 'AMEX' }

export const tappayProvider: PaymentProvider & {
  /** 以前端取得的 prime 完成請款 */
  payByPrime(ctx: ChargeContext, prime: string): Promise<CallbackResult>
} = {
  id: 'tappay',
  displayName: '信用卡（TapPay）',
  method: 'CREDIT_CARD',

  isConfigured: () =>
    Boolean(
      process.env.TAPPAY_PARTNER_KEY &&
        process.env.TAPPAY_MERCHANT_ID &&
        process.env.NEXT_PUBLIC_TAPPAY_APP_ID &&
        process.env.NEXT_PUBLIC_TAPPAY_APP_KEY,
    ),

  async createCharge(ctx: ChargeContext): Promise<ChargeInstruction> {
    if (!tappayProvider.isConfigured()) throw new PaymentError('TapPay 尚未設定完成，請檢查環境變數')
    // TapPay 由前端 SDK 收單，此處僅回傳前端所需設定
    return {
      kind: 'client',
      providerRef: ctx.bookingCode,
      clientConfig: {
        appId: Number(process.env.NEXT_PUBLIC_TAPPAY_APP_ID),
        appKey: process.env.NEXT_PUBLIC_TAPPAY_APP_KEY,
        serverType: process.env.NEXT_PUBLIC_TAPPAY_SERVER_TYPE || 'sandbox',
        amount: ctx.amount,
        bookingId: ctx.bookingId,
      },
    }
  },

  async payByPrime(ctx: ChargeContext, prime: string): Promise<CallbackResult> {
    if (!tappayProvider.isConfigured()) throw new PaymentError('TapPay 尚未設定完成')

    const res = await fetch(endpoints().payByPrime, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.TAPPAY_PARTNER_KEY as string,
      },
      body: JSON.stringify({
        prime,
        partner_key: process.env.TAPPAY_PARTNER_KEY,
        merchant_id: process.env.TAPPAY_MERCHANT_ID,
        amount: ctx.amount,
        currency: 'TWD',
        order_number: ctx.bookingCode,
        details: ctx.description.slice(0, 100),
        cardholder: {
          phone_number: ctx.customer.phone,
          name: ctx.customer.name,
          email: ctx.customer.email || 'noreply@example.com',
        },
        // 不代為保存卡片
        remember: false,
      }),
    })

    const data = (await res.json()) as TapPayResponse
    const ok = data.status === 0

    return {
      ok,
      providerRef: data.rec_trade_id ?? '',
      bookingCode: ctx.bookingCode,
      amount: data.amount ?? ctx.amount,
      cardLast4: data.card_info?.last_four ?? null,
      cardBrand: data.card_info?.type != null ? (CARD_TYPE[data.card_info.type] ?? null) : null,
      failReason: ok ? undefined : `TapPay ${data.status}：${data.msg}`,
      raw: scrubSensitive(data),
      ack: { body: 'OK', contentType: 'text/plain' },
    }
  },

  /** TapPay 為同步請款，無 server-to-server notify；此處僅接受 3D 驗證的回呼結果 */
  async handleCallback(req: Request): Promise<CallbackResult> {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const ok = Number(body.status) === 0
    return {
      ok,
      providerRef: String(body.rec_trade_id ?? ''),
      bookingCode: String(body.order_number ?? ''),
      amount: Number(body.amount ?? 0),
      failReason: ok ? undefined : String(body.msg ?? '付款失敗'),
      raw: scrubSensitive(body),
      ack: { body: 'OK', contentType: 'text/plain' },
    }
  },

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const res = await fetch(endpoints().refund, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.TAPPAY_PARTNER_KEY as string,
      },
      body: JSON.stringify({
        partner_key: process.env.TAPPAY_PARTNER_KEY,
        rec_trade_id: providerRef,
        amount,
      }),
    })
    const data = (await res.json()) as TapPayResponse
    return data.status === 0
      ? { ok: true, providerRef }
      : { ok: false, failReason: `TapPay 退款失敗 ${data.status}：${data.msg}` }
  },
}
