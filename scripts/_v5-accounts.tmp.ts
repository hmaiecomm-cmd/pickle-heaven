// 暫時檔：建立／清除 V5 驗收用測試帳號（開發庫）。用完即刪。
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { mainPrisma as db } from '../src/lib/db'
import { hashPassword, issueAdminSession } from '../src/lib/admin-auth'

if (!/^libsql:\/\/pickle-heaven-dev-/.test(process.env.TURSO_DATABASE_URL ?? '')) process.exit(1)
const ROLES = ['OWNER', 'MANAGER', 'OPERATOR', 'FRONTDESK', 'VIEWER'] as const
async function cleanup() {
  const accs = await db.adminAccount.findMany({ where: { username: { startsWith: 'TEST_v5_' } }, select: { id: true } })
  await db.adminSession.deleteMany({ where: { accountId: { in: accs.map((a) => a.id) } } })
  const n = await db.adminAccount.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } })
  console.log(`已清除測試帳號 ${n.count} 個`)
}
async function seed() {
  await cleanup()
  const lines: string[] = []
  for (const role of ROLES) {
    const username = `TEST_v5_${role}`
    const pw = randomBytes(12).toString('base64url')
    const acc = await db.adminAccount.create({ data: { username, usernameKey: username.toLowerCase(), displayName: role, passwordHash: await hashPassword(pw), role, tenant: 'main' } })
    const s = await issueAdminSession(acc, { ip: '127.0.0.1', userAgent: 'v5-e2e' })
    if (!s.ok) throw new Error(s.error)
    lines.push(`${role} ${s.token} ${pw}`)
  }
  writeFileSync(process.argv[3], lines.join('\n') + '\n')
  console.log(`已建立 ${ROLES.length} 個測試帳號`)
}
;(process.argv[2] === 'seed' ? seed() : cleanup()).then(() => process.exit(0))
