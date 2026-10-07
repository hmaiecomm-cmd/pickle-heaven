import crypto from 'node:crypto'
import type {
  CallbackResult,
  ChargeContext,
  ChargeInstruction,
  ChargeResult,
  PaymentProvider,
  RefundResult,
} from './types'
import { PaymentError, scrubSensitive } from './types'
import { brand } from '@/config/site'

/**
 * LINE Pay v3。
 * 在 LINE MINI App 內付款體驗最順暢：使用者不需離開 LINE。
 *
 * 流程：Request API 取得 paymentUrl → 導向使用者授權 → 導回 confirmUrl → Confirm API 實際扣款。
 */

function cfg() {
  const channelId = process.env.LINEPAY_CHANNEL_ID
  const channelSecret = process.env.LINEPAY_CHANNEL_SECRET
  const apiUrl = process.env.LINEPAY_API_URL || 'https://sandbox-api-pay.line.me'
  if (!channelId || !channelSecret) throw new PaymentError('LINE Pay 尚未設定完成，請檢查環境變數')
  return { channelId, channelSecret, apiUrl }
}

/** LINE Pay 簽章：Base64(HMAC-SHA256(secret, secret + uri + body + nonce)) */
function sign(channelSecret: string, uri: string, body: string, nonce: string): string {
  return crypto
    .createHmac('sha256', channelSecret)
    .update(channelSecret + uri + body + nonce)
    .digest('base64')
}

async function call<T>(uri: string, payload: unknown): Promise<T> {
  const { channelId, channelSecret, apiUrl } = cfg()
  const body = JSON.stringify(payload)
  const nonce = crypto.randomUUID()

  const res = await fetch(`${apiUrl}${uri}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': channelId,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': sign(channelSecret, uri, body, nonce),
    },
    body,
  })

  return (await res.json()) as T
}

interface LinePayResponse {
  returnCode: string
  returnMessage: string
  info?: {
    transactionId?: number
    paymentUrl?: { web?: string; app?: string }
    payInfo?: { method?: string; amount?: number }[]
  }
}

export const linepayProvider: PaymentProvider = {
  id: 'linepay',
  displayName: 'LINE Pay',
  method: 'LINE_PAY',

  isConfigured: () => Boolean(process.env.LINEPAY_CHANNEL_ID && process.env.LINEPAY_CHANNEL_SECRET),

  async createCharge(ctx: ChargeContext): Promise<ChargeInstruction> {
    const data = await call<LinePayResponse>('/v3/payments/request', {
      amount: ctx.amount,
      currency: 'TWD',
      orderId: ctx.bookingCode,
      packages: [
        {
          id: ctx.bookingId,
          amount: ctx.amount,
          name: `${brand.name} 場地預約`,
          products: ctx.itemNames.map((name) => ({ name, quantity: 1, price: 0 })),
        },
      ],
      redirectUrls: {
        confirmUrl: ctx.returnUrl,
        cancelUrl: ctx.cancelUrl,
      },
      options: { display: { locale: 'zh_TW' } },
    })

    if (data.returnCode !== '0000' || !data.info?.paymentUrl?.web) {
      throw new PaymentError(`LINE Pay 建立交易失敗 ${data.returnCode}：${data.returnMessage}`)
    }

    return {
      kind: 'redirect',
      providerRef: String(data.info.transactionId ?? ''),
      redirectUrl: data.info.paymentUrl.web,
    }
  },

  /** 使用者授權後導回，需呼叫 Confirm 才真正扣款 */
  async confirm(params: Record<string, string>): Promise<ChargeResult> {
    const transactionId = params.transactionId
    const amount = Number(params.amount)
    if (!transactionId) throw new PaymentError('缺少 transactionId')

    const data = await call<LinePayResponse>(`/v3/payments/${transactionId}/confirm`, {
      amount,
      currency: 'TWD',
    })

    const ok = data.returnCode === '0000'
    return {
      ok,
      providerRef: transactionId,
      amount,
      failReason: ok ? undefined : `LINE Pay ${data.returnCode}：${data.returnMessage}`,
      raw: scrubSensitive(data),
    }
  },

  /** LINE Pay 以導回 confirm 為主，此回呼供對帳補償使用 */
  async handleCallback(req: Request): Promise<CallbackResult> {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return {
      ok: String(body.returnCode ?? '') === '0000',
      providerRef: String(body.transactionId ?? ''),
      bookingCode: String(body.orderId ?? ''),
      amount: Number(body.amount ?? 0),
      raw: scrubSensitive(body),
      ack: { body: 'OK', contentType: 'text/plain' },
    }
  },

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const data = await call<LinePayResponse>(`/v3/payments/${providerRef}/refund`, { refundAmount: amount })
    return data.returnCode === '0000'
      ? { ok: true, providerRef }
      : { ok: false, failReason: `LINE Pay 退款失敗 ${data.returnCode}：${data.returnMessage}` }
  },
}
