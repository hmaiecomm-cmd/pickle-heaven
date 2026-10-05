/**
 * 金流抽象層。
 *
 * 安全原則（PCI-DSS）：
 *  - 本系統「絕不」接收、傳遞或儲存完整卡號、有效期限或 CVV。
 *  - 信用卡資料一律由金流商的前端 SDK（TapPay Fields）或其代管付款頁（NewebPay MPG、LINE Pay）收集。
 *  - 我方僅保存交易序號、金額、狀態，以及金流商回傳的遮罩末四碼與卡別。
 */

export interface ChargeContext {
  bookingId: string
  /** 訂單編號，會作為金流商的商店訂單編號 */
  bookingCode: string
  /** 新台幣整數元 */
  amount: number
  /** 商品描述，例：匹克天堂 場地預約 2 時段 */
  description: string
  itemNames: string[]
  customer: {
    name: string
    phone: string
    email: string | null
  }
  /** 付款完成後導回的前端頁面 */
  returnUrl: string
  /** 金流商 server-to-server 通知網址 */
  notifyUrl: string
  /** 使用者取消付款導回頁 */
  cancelUrl: string
}

export type ChargeInstruction =
  /** 直接導向金流商付款頁 */
  | { kind: 'redirect'; providerRef: string; redirectUrl: string }
  /** 需以 HTML form POST 送出（藍新 MPG） */
  | { kind: 'form'; providerRef: string; action: string; fields: Record<string, string> }
  /** 前端 SDK 收單（TapPay Fields），回傳前端所需設定 */
  | { kind: 'client'; providerRef: string; clientConfig: Record<string, unknown> }

export interface ChargeResult {
  ok: boolean
  providerRef: string
  /** 金流商回傳的遮罩末四碼，非完整卡號 */
  cardLast4?: string | null
  cardBrand?: string | null
  amount?: number
  failReason?: string
  /** 已濾除敏感欄位的原始回應，供對帳 */
  raw?: Record<string, unknown>
}

export interface CallbackResult extends ChargeResult {
  /** 用以定位訂單 */
  bookingCode: string
  /** 回覆給金流商的內容（部分金流商要求固定字串） */
  ack: { body: string; contentType: string }
}

export interface RefundResult {
  ok: boolean
  providerRef?: string
  failReason?: string
}

export interface PaymentProvider {
  readonly id: 'mock' | 'tappay' | 'newebpay' | 'linepay'
  readonly displayName: string
  readonly method: 'CREDIT_CARD' | 'LINE_PAY'
  /** 是否已具備必要環境變數 */
  isConfigured(): boolean
  /** 建立付款單，回傳前端該如何完成付款 */
  createCharge(ctx: ChargeContext): Promise<ChargeInstruction>
  /** 處理金流商的 server-to-server 通知 */
  handleCallback(req: Request): Promise<CallbackResult>
  /**
   * 需要二次確認的金流（LINE Pay）在使用者導回時呼叫。
   * 不需要者可不實作。
   */
  confirm?(params: Record<string, string>): Promise<ChargeResult>
  /** 退款（取消訂單時使用） */
  refund?(providerRef: string, amount: number): Promise<RefundResult>
}

export class PaymentError extends Error {
  code = 'PAYMENT_FAILED' as const
  constructor(message: string) {
    super(message)
    this.name = 'PaymentError'
  }
}

/** 移除回呼資料中的敏感欄位後才寫入資料庫 */
const SENSITIVE_KEYS = ['card_number', 'cardnumber', 'cvv', 'cvc', 'pan', 'expiry', 'card_key', 'card_token']

export function scrubSensitive(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[redacted]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrubSensitive(v)
    } else {
      out[k] = v
    }
  }
  return out
}
