/**
 * 產生後台管理員密碼雜湊，並寫回 .env 的 ADMIN_PASSWORD_HASH。
 *
 *   npm run admin:password -- 新密碼
 *
 * 明文密碼只存在於這次執行的記憶體中，不會寫進任何檔案。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { scryptSync, randomBytes } from 'node:crypto'

const password = process.argv.slice(2).join(' ').trim()
if (!password) {
  console.error('用法：npm run admin:password -- <新密碼>')
  process.exit(1)
}
if (password.length < 8) {
  console.error('❌ 密碼至少 8 個字元。')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
const stored = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`

const envPath = new URL('../.env', import.meta.url)
let env = readFileSync(envPath, 'utf8')

if (/^ADMIN_PASSWORD_HASH=.*$/m.test(env)) {
  env = env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH="${stored}"`)
} else {
  env = env.trimEnd() + `\nADMIN_PASSWORD_HASH="${stored}"\n`
}

writeFileSync(envPath, env)
console.log('✅ 已更新 .env 的 ADMIN_PASSWORD_HASH')
console.log('   請重新啟動開發伺服器讓新密碼生效。')
