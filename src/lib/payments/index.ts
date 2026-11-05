import { mockProvider } from './mock'
import { tappayProvider } from './tappay'
import { newebpayProvider } from './newebpay'
import { linepayProvider } from './linepay'
import type { PaymentProvider } from './types'

export * from './types'
export { mockProvider, tappayProvider, newebpayProvider, linepayProvider }

const REGISTRY = {
  mock: mockProvider,
  tappay: tappayProvider as PaymentProvider,
  newebpay: newebpayProvider,
  linepay: linepayProvider,
} as const

export type ProviderId = keyof typeof REGISTRY

export function isProviderId(id: string): id is ProviderId {
  return id in REGISTRY
}

/** 取得指定金流；未指定則使用 PAYMENT_PROVIDER 環境變數（預設 mock） */
export function getPaymentProvider(id?: string | null): PaymentProvider {
  const key = id ?? process.env.PAYMENT_PROVIDER ?? 'mock'
  if (!isProviderId(key)) {
    console.warn(`[payments] 未知的金流代號「${key}」，改用 mock`)
    return mockProvider
  }
  return REGISTRY[key]
}

/**
 * 模擬金流會直接把訂單標記為已付款，不會收款。
 * 非正式環境都可用；正式環境只限 MOCK_PAYMENT_USER_IDS（逗號分隔的會員編號）列出的測試者。
 */
export function canUseMockPayment(userId?: string | null): boolean {
  const production = process.env.VERCEL_ENV === 'production' || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)
  if (!production) return true
  if (!userId) return false
  return (process.env.MOCK_PAYMENT_USER_IDS ?? '').split(',').map((id) => id.trim()).includes(userId)
}

/** 這位會員結帳時可選的付款方式；正式環境未接金流且不是測試者時為空，代表線上付款尚未開放 */
export function checkoutProviders(userId?: string | null): ReturnType<typeof availableProviders> {
  const canMock = canUseMockPayment(userId)
  const providers = availableProviders().filter((p) => p.id !== 'mock' || canMock)
  if (canMock && !providers.some((p) => p.id === 'mock')) {
    providers.push({ id: 'mock', displayName: mockProvider.displayName, method: mockProvider.method })
  }
  return providers
}

/** 結帳頁可選的付款方式（僅列出已設定完成者） */
export function availableProviders(): { id: ProviderId; displayName: string; method: string }[] {
  const primary = (process.env.PAYMENT_PROVIDER ?? 'mock') as ProviderId
  const ids: ProviderId[] = [primary, 'linepay']
  const seen = new Set<ProviderId>()

  return ids
    .filter((id) => {
      if (seen.has(id) || !isProviderId(id)) return false
      seen.add(id)
      return REGISTRY[id].isConfigured()
    })
    .map((id) => ({
      id,
      displayName: REGISTRY[id].displayName,
      method: REGISTRY[id].method,
    }))
}
