/**
 * 破壞性指令的安全鎖。
 *
 * db:reset 會清空整個資料庫。本機與正式站若不小心指向同一個資料庫，
 * 誤按一次就會刪掉所有真實報名資料。這支腳本在破壞性指令前先攔一道。
 *
 * 判斷方式：比對 .env 的 TURSO_DATABASE_URL 與 PRODUCTION_DATABASE_URL。
 * 相同就中止；PRODUCTION_DATABASE_URL 沒設定時也會警告（無法確認安全）。
 *
 * 真的要對正式資料庫操作時：
 *   set ALLOW_PRODUCTION_RESET=1   （Windows CMD）
 *   $env:ALLOW_PRODUCTION_RESET=1  （PowerShell）
 */
import 'dotenv/config'

const current = (process.env.TURSO_DATABASE_URL ?? '').trim()
const production = (process.env.PRODUCTION_DATABASE_URL ?? '').trim()

const shortName = (url) => url.replace(/^libsql:\/\//, '').split('.')[0] || '(未設定)'

if (!current) {
  console.error('❌ .env 沒有 TURSO_DATABASE_URL，無法判斷目標資料庫。')
  process.exit(1)
}

if (process.env.ALLOW_PRODUCTION_RESET === '1') {
  console.log(`⚠️  已略過安全鎖，將對「${shortName(current)}」執行破壞性操作。`)
  process.exit(0)
}

if (!production) {
  console.error('⚠️  .env 沒有設定 PRODUCTION_DATABASE_URL，無法確認你不是對著正式資料庫操作。')
  console.error('   請在 .env 加上正式站的資料庫網址，這支安全鎖才能發揮作用。')
  process.exit(1)
}

if (current === production) {
  console.error('')
  console.error('🛑 已中止：目前指向的是「正式」資料庫。')
  console.error(`   資料庫：${shortName(current)}`)
  console.error('')
  console.error('   這個指令會清空所有資料，包含真實球友的報名紀錄。')
  console.error('   本機開發請把 .env 的 TURSO_DATABASE_URL 改成開發用資料庫。')
  console.error('')
  process.exit(1)
}

console.log(`✅ 目標資料庫「${shortName(current)}」不是正式庫，繼續執行。`)
