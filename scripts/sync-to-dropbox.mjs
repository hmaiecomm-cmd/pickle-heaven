/**
 * 把原始碼鏡像同步到 Dropbox（不含 node_modules / .next）。
 *
 *   npm run sync
 *
 * 用途：專案本體放在 Dropbox 之外（避免 Dropbox 鎖住 .next 造成建置失敗），
 * 但原始碼仍然要有雲端備份與跨裝置存取。這支腳本用 Windows 內建的 robocopy
 * 做增量鏡像，只複製有變動的檔案，很快。
 *
 * 目的地取自 .env 的 SOURCE_MIRROR_DIR。
 *
 * 注意：這是「單向」鏡像（本機 → Dropbox）。在 Dropbox 那邊改檔案不會回傳，
 * 而且下次執行會被覆蓋掉。請一律在專案本體編輯。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import 'dotenv/config'

const projectDir = resolve(import.meta.dirname, '..')
const target = process.env.SOURCE_MIRROR_DIR

if (!target) {
  console.error('❌ .env 未設定 SOURCE_MIRROR_DIR，不知道要同步到哪裡。')
  process.exit(1)
}

const dest = resolve(target)
if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

// 這些都能重建，不需要備份，也正是造成 Dropbox 衝突的來源
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  // 快照資料夾就放在同步目標底下。robocopy /MIR 會刪除目標中來源沒有的東西，
  // 不排除的話每次同步都會把所有快照清空。
  '匹克天堂-快照',
]
// .env* 含 Turso 金鑰與管理員密碼雜湊，不放進雲端同步資料夾。
// 需要還原時從 Vercel（vercel env pull）或 Turso Dashboard 取得。
const EXCLUDE_FILES = ['tsconfig.tsbuildinfo', 'desktop.ini']
const EXCLUDE_PATTERNS = ['.env*']

// 專案路徑可能含中文，直接當命令列參數傳給 robocopy 會編碼錯亂，
// 因此改寫出 UTF-8 BOM 的 .ps1 再執行（與 snapshot.mjs 相同作法）。
const quote = (p) => `'${p.replace(/'/g, "''")}'`
const script =
  `$ErrorActionPreference = 'Continue'\r\n` +
  `robocopy ${quote(projectDir)} ${quote(dest)} /MIR /NFL /NDL /NJH /NP ` +
  `/XD ${EXCLUDE_DIRS.map(quote).join(' ')} ` +
  `/XF ${[...EXCLUDE_FILES, ...EXCLUDE_PATTERNS].map(quote).join(' ')}\r\n` +
  `exit $LASTEXITCODE\r\n`

const ps1 = join(tmpdir(), `pickle-sync-${Date.now()}.ps1`)
writeFileSync(ps1, '﻿' + script, 'utf8')

try {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    stdio: 'inherit',
  })
} catch (err) {
  // robocopy 的結束代碼 0-7 都代表成功（1=有複製檔案、2=有多餘檔案…），8 以上才是錯誤
  const code = err.status ?? 0
  if (code >= 8) {
    console.error(`❌ 同步失敗（robocopy 代碼 ${code}）`)
    rmSync(ps1, { force: true })
    process.exit(1)
  }
} finally {
  rmSync(ps1, { force: true })
}

console.log(`\n✅ 原始碼已同步到 Dropbox`)
console.log(`   ${dest}`)
