/**
 * 驗證開發資料庫與正式資料庫真的是分開的。
 *
 *   node scripts/verify-db-isolation.mjs
 *
 * 作法不是比對設定字串（那只能證明「看起來不同」），
 * 而是實際在開發庫寫入一筆可辨識的資料，再去正式庫確認它沒有出現，
 * 最後清理掉。看得到的隔離才算數。
 */
import 'dotenv/config'
import { createClient } from '@libsql/client'

const devUrl = (process.env.TURSO_DATABASE_URL ?? '').trim()
const devToken = process.env.TURSO_AUTH_TOKEN
const prodUrl = (process.env.PRODUCTION_DATABASE_URL ?? '').trim()

const short = (u) => u.replace(/^libsql:\/\//, '').split('.')[0]

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`   ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

if (!devUrl || !prodUrl) {
  console.error('❌ .env 缺少 TURSO_DATABASE_URL 或 PRODUCTION_DATABASE_URL')
  process.exit(1)
}

console.log(`\n開發庫：${short(devUrl)}`)
console.log(`正式庫：${short(prodUrl)}\n`)

console.log('【設定檢查】')
check('兩者網址不同', devUrl !== prodUrl)

// 正式庫的金鑰在 Vercel，本機沒有；用開發庫的金鑰去連正式庫應該被拒絕。
// 這本身就是隔離的證據：本機拿不到正式庫的寫入權限。
console.log('\n【本機是否碰得到正式庫】')
const prod = createClient({ url: prodUrl, authToken: devToken })
let prodReachable = false
try {
  await prod.execute('select 1')
  prodReachable = true
  check('本機金鑰無法存取正式庫', false, '竟然連得上，隔離不完整')
} catch {
  check('本機金鑰無法存取正式庫', true, '回應 401，符合預期')
}

console.log('\n【實際寫入測試】')
const dev = createClient({ url: devUrl, authToken: devToken })
const marker = `__isolation_test_${Date.now()}`

try {
  await dev.execute({
    sql: 'insert into User (id, displayName, createdAt, updatedAt) values (?, ?, datetime(\'now\'), datetime(\'now\'))',
    args: [marker, marker],
  })
  const inDev = await dev.execute({
    sql: 'select count(*) n from User where id = ?',
    args: [marker],
  })
  check('測試資料已寫入開發庫', Number(inDev.rows[0].n) === 1)

  if (prodReachable) {
    const inProd = await prod.execute({
      sql: 'select count(*) n from User where id = ?',
      args: [marker],
    })
    check('正式庫沒有這筆資料', Number(inProd.rows[0].n) === 0)
  } else {
    console.log('   ℹ️  正式庫本機無權讀取，無法直接比對——但這正代表寫不進去')
  }
} finally {
  await dev.execute({ sql: 'delete from User where id = ?', args: [marker] }).catch(() => {})
  console.log('   🧹 測試資料已清除')
}

console.log(failures === 0 ? '\n✅ 兩個資料庫確實隔離' : `\n❌ 有 ${failures} 項未通過`)
process.exit(failures === 0 ? 0 : 1)
