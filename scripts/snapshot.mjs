/**
 * 專案快照（不使用 git 時的替代方案）。
 *
 *   npm run snapshot              建立快照
 *   npm run snapshot -- 說明文字   建立快照並加註說明
 *
 * 會把專案打包成 zip，排除 node_modules、.next 等可重建的目錄。
 *
 * 存放位置：
 *   SNAPSHOT_DIR        主要位置，預設為專案上一層的「匹克天堂-快照」。
 *                       刻意放在專案「外面」，避免快照又被下一次快照包進去。
 *   SNAPSHOT_MIRROR_DIR 可留空。設定後會另外複製一份到這裡，
 *                       用途是把備份送進 Dropbox 取得雲端保護。
 */
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
  copyFileSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import 'dotenv/config'

const projectDir = resolve(import.meta.dirname, '..')
const outDir = process.env.SNAPSHOT_DIR
  ? resolve(process.env.SNAPSHOT_DIR)
  : resolve(projectDir, '..', '匹克天堂-快照')
const mirrorDir = process.env.SNAPSHOT_MIRROR_DIR
  ? resolve(process.env.SNAPSHOT_MIRROR_DIR)
  : null

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}`

const note = process.argv.slice(2).join(' ').trim()
const safeNote = note.replace(/[\/:*?"<>|]/g, '-')
const zipPath = join(outDir, safeNote ? `${stamp}_${safeNote}.zip` : `${stamp}.zip`)

// node_modules 可由 npm install 重建；.next 是建置產物；desktop.ini 是 Dropbox 系統檔。
// .env* 含 Turso 金鑰與管理員密碼雜湊。快照會複製到 Dropbox，
// 所以連金鑰一起打包等於把憑證放上雲端硬碟，刻意排除。
const EXCLUDE = ['node_modules', '.next', '.git', 'tsconfig.tsbuildinfo', 'desktop.ini']
const EXCLUDE_PREFIX = ['.env']

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const items = readdirSync(projectDir).filter(
  (n) => !EXCLUDE.includes(n) && !EXCLUDE_PREFIX.some((p) => n.startsWith(p)),
)

// 專案路徑含中文，直接當命令列參數傳給 powershell.exe 會因編碼而失敗。
// 改成寫出一支 UTF-8 BOM 的 .ps1 再執行，PowerShell 就能正確讀到中文路徑。
const quote = (p) => `'${p}'`
const script =
  `$ErrorActionPreference = 'Stop'\r\n` +
  `Set-Location -LiteralPath ${quote(projectDir)}\r\n` +
  `Compress-Archive -LiteralPath ${items.map(quote).join(',')} ` +
  `-DestinationPath ${quote(zipPath)} -Force\r\n`

const ps1 = join(tmpdir(), `pickle-snapshot-${Date.now()}.ps1`)
writeFileSync(ps1, '\uFEFF' + script, 'utf8')

try {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    stdio: 'inherit',
  })
} finally {
  rmSync(ps1, { force: true })
}

const mb = (statSync(zipPath).size / 1024 / 1024).toFixed(1)
console.log(`\n✅ 快照已建立（${mb} MB）`)
console.log(`   ${zipPath}`)

// 另存一份到雲端資料夾。複製失敗不應讓整個快照視為失敗，主要那份已經寫好了。
if (mirrorDir && mirrorDir !== outDir) {
  try {
    if (!existsSync(mirrorDir)) mkdirSync(mirrorDir, { recursive: true })
    const mirrorPath = join(mirrorDir, basename(zipPath))
    copyFileSync(zipPath, mirrorPath)
    console.log(`   ${mirrorPath}（雲端備份）`)
  } catch (err) {
    console.warn(`⚠️  雲端備份複製失敗：${err.message}`)
  }
}
