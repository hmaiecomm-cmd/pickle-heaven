/**
 * 模擬金流權限驗收測試：正式環境只有 MOCK_PAYMENT_USER_IDS 列出的會員能用。
 *
 *   npm run verify:mock-access
 *
 * 不讀寫資料庫：通知端點在權限檢查就會被拒絕。
 */
import { POST } from '../src/app/api/payments/[provider]/notify/route'
import { canUseMockPayment, checkoutProviders } from '../src/lib/payments'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const ids = (userId?: string | null) => checkoutProviders(userId).map((p) => p.id).join(',')

async function main() {
  delete process.env.VERCEL_ENV
  delete process.env.MOCK_PAYMENT_USER_IDS
  check('非正式環境：未登入也可用模擬金流', canUseMockPayment(null))
  check('非正式環境：結帳可選模擬金流', ids('anyone').includes('mock'))

  process.env.VERCEL_ENV = 'production'
  check('正式環境未設定測試者：任何會員都不可用', !canUseMockPayment('u1'))
  check('正式環境未接金流：一般會員沒有付款方式', ids('u1') === '', ids('u1'))
  check('正式環境未登入：沒有付款方式', ids(null) === '', ids(null))

  process.env.MOCK_PAYMENT_USER_IDS = ' u1 , u2 '
  check('測試者可用（容許空白）', canUseMockPayment('u1') && canUseMockPayment('u2'))
  check('其他會員不可用', !canUseMockPayment('u3') && !canUseMockPayment(null) && !canUseMockPayment(''))
  check('測試者結帳可選模擬金流', ids('u1') === 'mock', ids('u1'))
  check('其他會員沒有付款方式', ids('u3') === '', ids('u3'))

  const res = await POST(
    new Request('https://example.test/api/payments/mock/notify', {
      method: 'POST',
      body: JSON.stringify({ result: 'success', ref: 'x', code: 'PH-TEST', amount: 1 }),
    }),
    { params: Promise.resolve({ provider: 'mock' }) },
  )
  check('正式環境未登入：模擬付款通知被拒絕（403）', res.status === 403, String(res.status))
}

main()
  .catch((err) => {
    console.error(err)
    results.push({ name: '例外', ok: false, detail: String(err) })
  })
  .finally(() => {
    const ok = results.filter((r) => r.ok).length
    console.log(`\n通過 ${ok}／${results.length}`)
    process.exit(ok === results.length ? 0 : 1)
  })
