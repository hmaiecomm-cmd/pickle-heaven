/**
 * 檢查快照是否完整可用（刪除舊檔前的把關）。
 *
 *   node scripts/verify-snapshots.mjs <快照資料夾>
 *
 * 每個 zip 會檢查：
 *   1. 壓縮檔本身沒有損壞（CRC 逐檔驗證）
 *   2. 含有重建專案必備的檔案
 *   3. 原始碼檔案數量合理，不是空殼
 *   4. 不含 .env 憑證
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const dir = resolve(process.argv[2] ?? '.')
if (!existsSync(dir)) {
  console.error(`找不到資料夾：${dir}`)
  process.exit(1)
}

/** 少了任何一個就無法重建專案。 */
const REQUIRED = ['package.json', 'prisma/schema.prisma', 'next.config.mjs', 'tsconfig.json']

const quote = (p) => `'${p.replace(/'/g, "''")}'`

/**
 * 用 PowerShell 逐檔解壓並讀取，藉此驗證 CRC。
 * 純讀 namelist 不會發現內容毀損，必須實際解出來。
 */
function inspect(zipPath) {
  const work = mkdtempSync(join(tmpdir(), 'verify-'))
  const ps1 = join(tmpdir(), `verify-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
  writeFileSync(
    ps1,
    '﻿' +
      `$ErrorActionPreference = 'Stop'\r\n` +
      `Expand-Archive -LiteralPath ${quote(zipPath)} -DestinationPath ${quote(work)} -Force\r\n`,
    'utf8',
  )

  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    const files = []
    const walk = (base, rel = '') => {
      for (const name of readdirSync(join(base, rel), { withFileTypes: true })) {
        const child = rel ? `${rel}/${name.name}` : name.name
        if (name.isDirectory()) walk(base, child)
        else files.push(child)
      }
    }
    walk(work)

    // 抽驗一個關鍵檔的內容，確認不是零位元組的空殼
    const pkgPath = join(work, 'package.json')
    const pkgOk = existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf8')).name === 'pickle-heaven'

    return { files, pkgOk }
  } finally {
    rmSync(ps1, { force: true })
    rmSync(work, { recursive: true, force: true })
  }
}

const zips = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.zip')).sort()
let bad = 0

console.log(`檢查 ${zips.length} 個快照：${dir}\n`)

for (const name of zips) {
  const label = name.replace(/\.zip$/, '')
  try {
    const { files, pkgOk } = inspect(join(dir, name))
    const missing = REQUIRED.filter((r) => !files.includes(r))
    const srcCount = files.filter((f) => f.startsWith('src/')).length
    const secrets = files.filter((f) => f.startsWith('.env') && f !== '.env.example')

    const problems = []
    if (missing.length) problems.push(`缺少 ${missing.join('、')}`)
    if (!pkgOk) problems.push('package.json 內容異常')
    if (srcCount < 40) problems.push(`src 檔案僅 ${srcCount} 個，疑似不完整`)
    if (secrets.length) problems.push(`仍含憑證 ${secrets.join('、')}`)

    if (problems.length) {
      console.log(`✘ ${label}\n    ${problems.join('\n    ')}`)
      bad++
    } else {
      console.log(`✔ ${label}　（共 ${files.length} 檔，src ${srcCount} 個）`)
    }
  } catch (err) {
    console.log(`✘ ${label}\n    解壓失敗：${String(err.message).split('\n')[0]}`)
    bad++
  }
}

console.log(bad === 0 ? `\n✅ 全部 ${zips.length} 個快照都完整可用` : `\n❌ 有 ${bad} 個快照有問題`)
process.exit(bad === 0 ? 0 : 1)
