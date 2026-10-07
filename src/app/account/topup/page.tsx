import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Coins, Sparkles } from 'lucide-react'
import { getSessionUser, SessionUnavailableError } from '@/lib/session'
import { brand } from '@/config/site'
import { ntd } from '@/lib/utils'
import { LoginPrompt } from '@/components/login-prompt'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listActivePlans, topUpAvailability } from '@/server/topup-service'

export const metadata: Metadata = { title: '儲值點數' }
export const dynamic = 'force-dynamic'

/**
 * 儲值點數：選擇方案 → 確認內容 → 付款 → 等待付款確認 → 點數入帳 → 交易紀錄。
 * 方案由擁有者在後台設定；正式金流未接通時顯示「線上儲值尚未開放」。
 */
export default async function TopUpPage() {
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (err) {
    if (err instanceof SessionUnavailableError) return <p className="py-10 text-center text-sm text-muted">目前暫時無法確認登入狀態，請稍後再試。</p>
    throw err
  }
  if (!user) return <LoginPrompt title={`登入${brand.name}`} description="登入後可為目前帳戶儲值點數。" next="/account/topup" />

  const avail = topUpAvailability()
  const plans = avail.open ? await listActivePlans() : []

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">儲值點數</h1>
          <p className="text-xs text-muted">
            儲值對象：{user.displayName}（目前登入帳戶）・可用點數 <span className="font-semibold text-brand-700 tabular">{user.points}</span>
          </p>
        </div>
        <Link href="/account?tab=points" className="text-sm text-brand-600 hover:underline">我的點數</Link>
      </div>

      {user.restricted && (
        <Card>
          <CardContent className="text-sm text-amber-800">此帳戶目前限制使用，無法新增儲值，若有疑問請聯絡場館。</CardContent>
        </Card>
      )}

      {!avail.open ? (
        <Card>
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Coins className="h-4 w-4" aria-hidden />線上儲值尚未開放</p>
            <p className="text-sm text-muted">{avail.reason}</p>
          </CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted">目前沒有可用的儲值方案，請稍後再試或洽場館櫃台。</CardContent>
        </Card>
      ) : (
        <>
          {avail.simulated && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">測試環境：付款使用模擬金流，不會實際扣款。</p>}
          <p className="text-xs text-muted">步驟 1／4：選擇儲值方案。付費點數與贈送點數分開記錄；點數儲值不能再以點數付款。</p>
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-sm">
                        支付 <span className="font-semibold tabular">{ntd(p.price)}</span>，取得 <span className="font-semibold tabular">{p.points}</span> 點
                        {p.bonusPoints > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 text-xs font-medium text-brand-700"><Sparkles className="h-3 w-3" aria-hidden />贈 {p.bonusPoints} 點</span>
                        )}
                      </p>
                      {(p.scopeNote || p.validityNote) && <p className="mt-1 text-xs text-muted">{[p.scopeNote, p.validityNote].filter(Boolean).join('・')}</p>}
                    </div>
                    <Button asChild size="sm" disabled={user.restricted}>
                      <Link href={user.restricted ? '#' : `/account/topup/confirm?plan=${p.id}`} aria-disabled={user.restricted}>
                        選擇
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
