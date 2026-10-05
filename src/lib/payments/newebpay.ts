import crypto from 'node:crypto'
import type {
  CallbackResult,
  ChargeContext,
  ChargeInstruction,
  PaymentProvider,
} from './types'
import { PaymentError, scrubSensitive } from './types'

/**
 * 藍新金流 NewebPay（MPG 幕前支付）。
 *
 * 使用者會被導向藍新代管的付款頁輸入卡號，
 * 我方只送出加密後的訂單資訊，並在 NotifyURL 接收付款結果，
 * 全程不接觸卡號。
 */

const VERSION = '2.0'

function cfg() {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID
  const hashKey = process.env.NEWEBPAY_HASH_KEY
  const hashIv = process.env.NEWEBPAY_HASH_IV
  const apiUrl = process.env.NEWEBPAY_API_URL || 'https://ccore.newebpay.com/MPG/mpg_gateway'
  if (!merchantId || !hashKey || !hashIv) throw new PaymentError('藍新金流尚未設定完成，請檢查環境變數')
  return { merchantId, hashKey, hashIv, apiUrl }
}

/** AES-256-CBC 加密（PKCS7），輸出 hex — 藍新 TradeInfo 格式 */
function encryptTradeInfo(plain: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'))
  return cipher.update(plain, 'utf8', 'hex') + cipher.final('hex')
}

/** AES-256-CBC 解密 */
function decryptTradeInfo(encrypted: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'))
  decipher.setAutoPadding(false)
  const out = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
  // 手動移除 PKCS7 padding（藍新部分回應的 padding 不被 Node 自動處理接受）
  return out.replace(/[\x00-\x1f]+$/, '')
}

/** TradeSha = SHA256("HashKey=xxx&<TradeInfo>&HashIV=yyy") 轉大寫 */
function tradeSha(tradeInfo: string, key: string, iv: string): string {
  return crypto
    .createHash('sha256')
    .update(`HashKey=${key}&${tradeInfo}&HashIV=${iv}`)
    .digest('hex')
    .toUpperCase()
}

export const newebpayProvider: PaymentProvider = {
  id: 'newebpay',
  displayName: '信用卡（藍新金流）',
  method: 'CREDIT_CARD',

  isConfigured: () =>
    Boolean(process.env.NEWEBPAY_MERCHANT_ID && process.env.NEWEBPAY_HASH_KEY && process.env.NEWEBPAY_HASH_IV),

  async createCharge(ctx: ChargeContext): Promise<ChargeInstruction> {
    const { merchantId, hashKey, hashIv, apiUrl } = cfg()

    const params = new URLSearchParams({
      MerchantID: merchantId,
      RespondType: 'JSON',
      TimeStamp: String(Math.floor(Date.now() / 1000)),
      Version: VERSION,
      MerchantOrderNo: ctx.bookingCode.replace(/-/g, ''),
      Amt: String(ctx.amount),
      ItemDesc: ctx.description.slice(0, 50),
      ReturnURL: ctx.returnUrl,
      NotifyURL: ctx.notifyUrl,
      ClientBackURL: ctx.cancelUrl,
      Email: ctx.customer.email || '',
      EmailModify: '0',
      LoginType: '0',
      // 僅開放信用卡一次付清
      CREDIT: '1',
    })

    const tradeInfo = encryptTradeInfo(params.toString(), hashKey, hashIv)

    return {
      kind: 'form',
      providerRef: ctx.bookingCode,
      action: apiUrl,
      fields: {
        MerchantID: merchantId,
        TradeInfo: tradeInfo,
        TradeSha: tradeSha(tradeInfo, hashKey, hashIv),
        Version: VERSION,
      },
    }
  },

  async handleCallback(req: Request): Promise<CallbackResult> {
    const { hashKey, hashIv } = cfg()
    const form = await req.formData()
    const tradeInfo = String(form.get('TradeInfo') ?? '')
    const sha = String(form.get('TradeSha') ?? '')

    // 驗章：確認回呼確實來自藍新且未被竄改
    if (!tradeInfo || tradeSha(tradeInfo, hashKey, hashIv) !== sha.toUpperCase()) {
      throw new PaymentError('藍新回呼驗章失敗')
    }

    const decoded = JSON.parse(decryptTradeInfo(tradeInfo, hashKey, hashIv)) as {
      Status: string
      Message: string
      Result: {
        MerchantOrderNo: string
        Amt: number
        TradeNo: string
        Card4No?: string
        PaymentType?: string
      }
    }

    const ok = decoded.Status === 'SUCCESS'
    return {
      ok,
      providerRef: decoded.Result?.TradeNo ?? '',
      // 送出時移除了連字號，此處還原比對用的訂單編號
      bookingCode: decoded.Result?.MerchantOrderNo ?? '',
      amount: Number(decoded.Result?.Amt ?? 0),
      cardLast4: decoded.Result?.Card4No ?? null,
      cardBrand: decoded.Result?.PaymentType ?? null,
      failReason: ok ? undefined : `藍新 ${decoded.Status}：${decoded.Message}`,
      raw: scrubSensitive(decoded),
      ack: { body: 'OK', contentType: 'text/plain' },
    }
  },
}
