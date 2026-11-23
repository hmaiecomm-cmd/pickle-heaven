/**
 * IoT 互動測試：準備「開發資料庫」（預設讀 .env.local 的 pickle-heaven-dev）
 *
 *   npm run iot:dev:setup                      套用 IoT 欄位、補 18 路迴路、設定場館代碼與連線對象
 *   npm run iot:dev:setup -- --site xindian001 --target SIMULATOR --venue taipei-dazhi
 *
 * 只新增、不刪除。與 .env 的 PRODUCTION_DATABASE_URL 相同時一律中止。
 */
import { readFileSync } from 'node:fs'

function readEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
        }),
    )
  } catch {
    return {}
  }
}

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const local = readEnv('.env.local')
const base = readEnv('.env')
const url = process.env.IOT_DEV_DATABASE_URL ?? local.TURSO_DATABASE_URL
const token = process.env.IOT_DEV_DATABASE_AUTH_TOKEN ?? local.TURSO_AUTH_TOKEN
const production = (base.PRODUCTION_DATABASE_URL ?? '').trim()
const short = (u: string) => u.replace(/^libsql:\/\//, '').split('.')[0]

if (!url) throw new Error('找不到開發資料庫：.env.local 沒有 TURSO_DATABASE_URL')
if (!production) throw new Error('.env 沒有 PRODUCTION_DATABASE_URL，無法確認不是正式庫，中止')
if (url.trim() === production) throw new Error(`目標是正式庫（${short(url)}），中止`)

process.env.TURSO_DATABASE_URL = url
process.env.TURSO_AUTH_TOKEN = token ?? ''
delete process.env.DEMO_DATABASE_URL

const siteCode = arg('site') ?? 'xindian001'
const target = (arg('target') ?? 'SIMULATOR').toUpperCase()
if (!['LIVE', 'SIMULATOR'].includes(target)) throw new Error('--target 只能是 LIVE 或 SIMULATOR')

console.log(`▶ 目標資料庫：${short(url)}`)

const { createClient } = await import('@libsql/client')
const raw = createClient({ url, authToken: token })
for (const file of ['prisma/migrations-manual/2026-11-23a_iot_site_code.sql', 'prisma/migrations-manual/2026-11-23b_iot_target.sql']) {
  const statements = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const sql of statements) {
    try {
      await raw.execute(sql)
    } catch (e) {
      if (!/duplicate column name/i.test((e as Error).message)) throw e
    }
  }
  console.log(`  ✔ ${file}`)
}
raw.close()

const { prisma } = await import('@/lib/db')
const { CIRCUIT_DEFINITIONS } = await import('@/lib/control-types')

const slug = arg('venue')
const venue = slug ? await prisma.venue.findUnique({ where: { slug } }) : await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })
if (!venue) throw new Error('找不到場館')
await prisma.venue.update({ where: { id: venue.id }, data: { siteCode, iotTarget: target } })
console.log(`  ✔ 場館 ${venue.slug}：siteCode=${siteCode}，連線對象=${target}（Gateway 場館 ID：${target === 'SIMULATOR' ? `${siteCode}-sim` : siteCode}）`)

let created = 0
for (const [no, def] of Object.entries(CIRCUIT_DEFINITIONS)) {
  const exists = await prisma.circuit.findFirst({ where: { circuitNumber: no } })
  if (exists) continue
  await prisma.circuit.create({
    data: {
      venueId: venue.id,
      circuitNumber: no,
      name: def.name,
      category: def.category,
      enabled: def.defaultEnabled,
      remoteControlEnabled: def.remoteControlEnabled,
      scheduleControlEnabled: def.scheduleControlEnabled,
      reservationAdvanceMinutes: def.category === 'RESERVATION_DYNAMIC' ? 5 : null,
      reservationDelayMinutes: def.category === 'RESERVATION_DYNAMIC' ? 5 : null,
    },
  })
  created++
}
console.log(`  ✔ 迴路：新增 ${created} 路（已存在的不動）`)
await prisma.$disconnect()
console.log('\n完成')
