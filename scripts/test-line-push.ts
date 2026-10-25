/**
 * LINE 推播測試：用網站的「訂單成立」Flex 訊息格式送一則測試通知。
 *   npm run verify:line-push -- <LINE userId（U 開頭）>   只送給這一位
 *   npm run verify:line-push -- --broadcast              群發給官方帳號「所有」好友
 *
 * 群發前務必先在 LINE Official Account Manager 確認好友只有測試者本人。
 * 不讀取資料庫、不建立訂單。對方必須已加官方帳號好友，且 userId 須與官方帳號在同一個 Provider。
 */
import { brand } from '../src/config/site'
import { buildBookingFlex } from '../src/lib/line'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'

const arg = process.argv[2]
const broadcast = arg === '--broadcast'
if (!broadcast && (!arg || !/^U[0-9a-f]{32}$/.test(arg))) {
  console.error('用法：npm run verify:line-push -- <U 開頭、共 33 字元的 LINE userId> 或 --broadcast')
  process.exit(1)
}
const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
if (!token) {
  console.error('❌ .env 缺少 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN')
  process.exit(1)
}

const flex = buildBookingFlex({
  code: 'TEST-0001',
  venueName: brand.name,
  venueAddress: '（測試訊息）',
  playDate: new Date().toISOString().slice(0, 10),
  items: [{ courtName: 'A 場', startMinute: 19 * 60, endMinute: 20 * 60 }],
  total: 0,
  bookingId: 'test',
})

async function main() {
  const messages = [{ type: 'text', text: `【測試】這是 ${brand.name} 的訂單通知測試，不是真的訂單。` }, flex]
  const res = await fetch(broadcast ? LINE_BROADCAST_URL : LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(broadcast ? { messages } : { to: arg, messages }),
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`❌ 推播失敗（${res.status}）${body}`)
    process.exit(1)
  }
  console.log('✅ 已送出測試通知，請到 LINE 查看')
}

main()
