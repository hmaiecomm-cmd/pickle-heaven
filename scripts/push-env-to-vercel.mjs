/**
 * 把正式環境需要的變數從 .env 推送到 Vercel。
 *
 *   npm run vercel:env
 *
 * 必須先完成 vercel link（專案資料夾裡要有 .vercel/project.json）。
 *
 * 刻意只推送白名單內的變數：
 *   - DEV_LOGIN / NEXT_PUBLIC_DEV_LOGIN 是本機免密碼測試用的後門，絕不能上正式環境
 *   - SNAPSHOT_DIR 等只在本機有意義
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectDir = resolve(import.meta.dirname, '..')

if (!existsSync(resolve(projectDir, '.vercel', 'project.json'))) {
  console.error('❌ 找不到 .vercel/project.json，請先執行：')
  console.error('   vercel link --yes --project pickle-heaven')
  process.exit(1)
}

/**
 * 會被推送到 Vercel 的變數。沒有列在這裡的一律不送。
 *
 * 刻意排除 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN：
 * 本機 .env 指向「開發」資料庫，推上去會讓正式站改連開發庫，
 * 真實報名資料就看不到了。正式站的資料庫設定只在 Vercel 後台維護。
 */
const ALLOW = [
  'SESSION_SECRET',
  'CRON_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
  'PAYMENT_PROVIDER',
  'NEXT_PUBLIC_PAYMENT_PROVIDER',
  'NEXT_PUBLIC_APP_URL',
]

const env = {}
for (const line of readFileSync(resolve(projectDir, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)
  if (m) env[m[1]] = m[2]
}

const targets = ['production', 'preview', 'development']
let pushed = 0
let skipped = 0

for (const key of ALLOW) {
  const value = env[key]
  if (!value) {
    console.log(`⏭️  ${key} 在 .env 中沒有值，略過`)
    skipped++
    continue
  }

  for (const target of targets) {
    try {
      // 先移除舊值，否則重複新增會失敗
      execFileSync('vercel', ['env', 'rm', key, target, '--yes'], {
        cwd: projectDir,
        stdio: 'ignore',
        shell: true,
      })
    } catch {
      // 本來就不存在，屬於正常情況
    }

    execFileSync('vercel', ['env', 'add', key, target], {
      cwd: projectDir,
      input: value,
      stdio: ['pipe', 'ignore', 'inherit'],
      shell: true,
    })
  }

  console.log(`✅ ${key}`)
  pushed++
}

console.log(`\n完成：推送 ${pushed} 個變數，略過 ${skipped} 個`)
console.log('⚠️  DEV_LOGIN 與 NEXT_PUBLIC_DEV_LOGIN 刻意未推送（正式環境必須關閉）')
console.log('\n接著執行：vercel --prod')
