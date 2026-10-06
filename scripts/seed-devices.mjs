/**
 * 為每面還沒有裝置的球場建立標準裝置組：門禁、照明、風扇、四支攝影機、喇叭。
 * 冪等：已有任何裝置的球場會略過。
 *
 *   node scripts/seed-devices.mjs
 *
 * 要套用到正式庫時，同一行先指定正式庫的 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。
 */
import { randomUUID } from 'node:crypto'
import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env
if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}
const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
console.log(`目標：${TURSO_DATABASE_URL.replace(/^libsql:\/\//, '').split('.')[0]}`)

const STANDARD = [
  ['DOOR', '門禁', 'LOCKED'],
  ['LIGHTS', '照明', 'OFF'],
  ['FANS', '風扇', 'OFF'],
  ['CAMERA', '攝影機 (NW)', null],
  ['CAMERA', '攝影機 (NE)', null],
  ['CAMERA', '攝影機 (SW)', null],
  ['CAMERA', '攝影機 (SE)', null],
  ['SPEAKER', '喇叭', null],
]

const courts = (await client.execute('select c.id, c.name, (select count(*) from Device d where d.courtId = c.id) n from Court c order by c.sortOrder')).rows
const now = new Date().toISOString().replace('Z', '+00:00')
let created = 0
for (const c of courts) {
  if (Number(c.n) > 0) {
    console.log(`↩️  ${c.name} 已有 ${c.n} 個裝置，略過`)
    continue
  }
  const stmts = STANDARD.map(([type, label, action]) => ({
    sql: 'insert into Device (id, courtId, type, name, status, lastSeen, lastAction, createdAt, updatedAt) values (?,?,?,?,?,?,?,?,?)',
    args: [randomUUID().replace(/-/g, ''), c.id, type, `${c.name} - ${label}`, 'ONLINE', now, action, now, now],
  }))
  await client.batch(stmts, 'write')
  created += stmts.length
  console.log(`✅ ${c.name} 建立 ${stmts.length} 個裝置`)
}
console.log(`\n完成，共建立 ${created} 個裝置。`)
