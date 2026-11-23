import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { getPaymentProvider, type ProviderId } from '@/lib/payments'

export const runtime = 'nodejs'

/**
 * GET /api/admin/settings/payment-config
 *
 * 返回所有支付方式的配置狀態
 *
 * 回應：
 * {
 *   "configured": [{ id, displayName, method, status, issues }],
 *   "unconfigured": [{ id, displayName, method, status, requiredEnvVars, setupGuide, instructions }],
 *   "current": { primary, available },
 *   "notes": { production, canUseMock }
 * }
 */
export async function GET(_req: NextRequest) {
  try {
    const ctx = await pagePermission('settings')
    if (ctx === 'forbidden') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const providers: ProviderId[] = ['newebpay', 'tappay', 'linepay']

    const configured = []
    const unconfigured = []

    for (const providerId of providers) {
      const provider = getPaymentProvider(providerId)
      const isReady = provider.isConfigured()

      const info = {
        id: providerId,
        displayName: provider.displayName,
        method: provider.method,
        status: isReady ? ('ready' as const) : ('unconfigured' as const),
      }

      if (isReady) {
        configured.push({
          ...info,
          issues: [],
        })
      } else {
        const requiredVars = getRequiredEnvVars(providerId)
        unconfigured.push({
          ...info,
          requiredEnvVars: requiredVars,
          setupGuide: getSetupGuideUrl(providerId),
          instructions: getSetupInstructions(providerId),
        })
      }
    }

    const primary = (process.env.PAYMENT_PROVIDER ?? 'mock') as ProviderId
    const available = configured.map((p) => p.id)

    return NextResponse.json({
      configured,
      unconfigured,
      current: {
        primary,
        available,
      },
      notes: {
        production: process.env.VERCEL_ENV === 'production',
        canUseMock: process.env.NODE_ENV !== 'production',
      },
    })
  } catch (error) {
    console.error('[API] GET /payment-config error:', error)
    return NextResponse.json(
      { error: '取得配置失敗' },
      { status: 500 }
    )
  }
}

function getRequiredEnvVars(providerId: ProviderId): string[] {
  const mapping: Record<ProviderId, string[]> = {
    mock: [],
    newebpay: [
      'NEWEBPAY_MERCHANT_ID',
      'NEWEBPAY_HASH_KEY',
      'NEWEBPAY_HASH_IV',
    ],
    tappay: [
      'NEXT_PUBLIC_TAPPAY_APP_ID',
      'NEXT_PUBLIC_TAPPAY_APP_KEY',
      'TAPPAY_PARTNER_KEY',
      'TAPPAY_MERCHANT_ID',
    ],
    linepay: [
      'LINEPAY_CHANNEL_ID',
      'LINEPAY_CHANNEL_SECRET',
    ],
  }
  return mapping[providerId] ?? []
}

function getSetupGuideUrl(providerId: ProviderId): string {
  const urls: Record<ProviderId, string> = {
    mock: '#',
    newebpay: 'https://www.newebpay.com/guide',
    tappay: 'https://tappay.com/document',
    linepay: 'https://pay.line.me/web/documents',
  }
  return urls[providerId] ?? '#'
}

function getSetupInstructions(providerId: ProviderId): string {
  const instructions: Record<ProviderId, string> = {
    mock: '開發用，無需配置',
    newebpay: `藍新金流設定步驟：
1. 至 https://merchant.newebpay.com 申請商家帳號
2. 取得 Merchant ID、Hash Key、Hash IV
3. 在 Vercel / 本機環境變數填入上述三個值
4. 設定回傳 URL：https://你的域名/api/payments/newebpay/notify
5. 申請測試卡號進行測試
6. 切換到正式環境金鑰後啟用`,
    tappay: `TapPay 設定步驟：
1. 至 https://tappay.com 申請開發者帳號
2. 建立一個應用，取得 App ID 和 App Key
3. 在環境變數填入 NEXT_PUBLIC_TAPPAY_APP_ID 等四項
4. 伺服器端需實現 /api/payments/tappay/prime 端點
5. 測試環境驗證後再啟用正式金鑰`,
    linepay: `LINE Pay 設定步驟：
1. 至 https://pay.line.me/merchants 申請商家帳號
2. 建立 Sandbox 環境，取得 Channel ID 和 Secret
3. 在環境變數填入 LINEPAY_CHANNEL_ID 和 LINEPAY_CHANNEL_SECRET
4. 設定回傳 URL：
   - Confirm URL：https://你的域名/checkout/result
   - Callback URL：https://你的域名/api/payments/linepay/notify
5. 測試完成後申請正式帳號`,
  }
  return instructions[providerId] ?? ''
}
