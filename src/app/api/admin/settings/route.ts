import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'
import { REFUND_POLICY_ROWS } from '@/lib/pricing'
import { PAYMENT_WINDOW_MINUTES } from '@/server/booking-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const has = (...keys: string[]) => keys.every((k) => (process.env[k] ?? '').trim().length > 0)

const PROVIDER_LABEL: Record<string, string> = { mock: '模擬金流（開發用）', tappay: 'TapPay', newebpay: '藍新 NewebPay', linepay: 'LINE Pay' }

/**
 * 系統設定（Phase 2）。
 * 場館資料來自 Venue；金流與整合只回報「是否已設定」，絕不回傳任何金鑰值。
 */
export async function GET() {
  if (!(await requireAdminApi())) return unauthorized()

  const [organization, venues] = await Promise.all([
    prisma.organization.findFirst({ where: { active: true }, select: { name: true } }),
    prisma.venue.findMany({ orderBy: { name: 'asc' } }),
  ])

  const provider = (process.env.PAYMENT_PROVIDER ?? 'mock').trim() || 'mock'
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  const database = (process.env.TURSO_DATABASE_URL ?? '').replace(/^libsql:\/\//, '').split('.')[0] || '未設定'

  const warnings: { level: 'danger' | 'warning'; message: string }[] = []
  if (isProd && (process.env.DEV_LOGIN === '1' || process.env.NEXT_PUBLIC_DEV_LOGIN === '1')) {
    warnings.push({ level: 'danger', message: '正式環境開啟了免密碼測試登入（DEV_LOGIN），任何人都能登入，請立即從 Vercel 移除。' })
  }
  if (isProd && provider === 'mock') warnings.push({ level: 'warning', message: '金流仍為模擬模式，顧客付款不會實際扣款。' })
  if ((process.env.SESSION_SECRET ?? '').length < 32) warnings.push({ level: 'warning', message: 'SESSION_SECRET 少於 32 字元，建議更換為更長的隨機字串。' })
  if (!has('CRON_SECRET') || process.env.CRON_SECRET === 'change-me') warnings.push({ level: 'warning', message: 'CRON_SECRET 未設定或仍為預設值，排程端點缺乏保護。' })

  return NextResponse.json({
    success: true,
    data: {
      organization,
      venues: venues.map((v) => ({
        id: v.id,
        name: v.name,
        address: v.address,
        phone: v.phone,
        description: v.description ?? '',
        notice: v.notice ?? '',
        policy: v.policy ?? '',
        openMinute: v.openMinute,
        closeMinute: v.closeMinute,
        slotMinutes: v.slotMinutes,
        bookAheadDays: v.bookAheadDays,
        holdMinutes: v.holdMinutes,
        timezone: v.timezone,
        active: v.active,
      })),
      payment: {
        provider,
        providerLabel: PROVIDER_LABEL[provider] ?? provider,
        providers: [
          { key: 'tappay', label: 'TapPay 信用卡', configured: has('TAPPAY_PARTNER_KEY', 'TAPPAY_MERCHANT_ID', 'NEXT_PUBLIC_TAPPAY_APP_ID') },
          { key: 'newebpay', label: '藍新 NewebPay', configured: has('NEWEBPAY_MERCHANT_ID', 'NEWEBPAY_HASH_KEY', 'NEWEBPAY_HASH_IV') },
          { key: 'linepay', label: 'LINE Pay', configured: has('LINEPAY_CHANNEL_ID', 'LINEPAY_CHANNEL_SECRET') },
        ],
      },
      integrations: [
        { key: 'liff', label: 'LINE LIFF 登入', configured: has('NEXT_PUBLIC_LIFF_ID', 'LINE_LOGIN_CHANNEL_ID') },
        { key: 'messaging', label: 'LINE 訊息推播', configured: has('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN') },
        { key: 'cron', label: '排程保護（CRON_SECRET）', configured: has('CRON_SECRET') && process.env.CRON_SECRET !== 'change-me' },
        { key: 'admin', label: '後台帳號', configured: has('ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH') },
        { key: 'anthropic', label: 'Claude API（AI 管理助理）', configured: has('ANTHROPIC_API_KEY') },
      ],
      system: {
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        region: process.env.VERCEL_REGION ?? null,
        database,
        adminSource: process.env.NEXT_PUBLIC_ADMIN_SOURCE === 'mock' ? 'mock' : 'live',
      },
      rules: { paymentWindowMinutes: PAYMENT_WINDOW_MINUTES, refundPolicy: REFUND_POLICY_ROWS },
      warnings,
    },
  })
}
