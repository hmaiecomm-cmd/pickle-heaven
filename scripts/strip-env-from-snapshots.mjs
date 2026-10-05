/**
 * 把快照裡的 .env*（憑證）移除後，輸出乾淨版本到另一個資料夾。
 *
 *   node scripts/strip-env-from-snapshots.mjs <來源資料夾> <目的資料夾>
 *
 * 2026-09-22 之前建立的快照含有 Turso 金鑰與管理員密碼雜湊，
 * 而快照會同步到 Dropbox，等於把憑證放上雲端硬碟。
 * 這支腳本保留版本歷史，只把憑證檔拿掉。
 *
 * 設計成「讀來源、寫目的」而不是原地覆寫：來源永遠不會被修改，
 * 中途失敗也不會弄丟任何東西。.env.example 是範本、沒有真實值，予以保留。
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const [srcArg, destArg] = process.argv.slice(2)
if (!srcArg || !destArg) {
  console.error('用法：node scripts/strip-env-from-snapshots.mjs <來源資料夾> <目的資料夾>')
  process.exit(1)
}

const src = resolve(srcArg)
const dest = resolve(destArg)
if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

const quote = (p) => `'${p.replace(/'/g, "''")}'`

function runPs(script) {
  const ps1 = join(tmpdir(), `strip-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
  writeFileSync(ps1, '﻿' + script, 'utf8')
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  } finally {
    rmSync(ps1, { force: true })
  }
}

const zips = readdirSync(src).filter((n) => n.toLowerCase().endsWith('.zip'))
let cleaned = 0
let copied = 0
let failed = 0

for (const name of zips) {
  const srcZip = join(src, name)
  const outZip = join(dest, name)
  const work = mkdtempSync(join(tmpdir(), 'snap-'))

  try {
    runPs(`Expand-Archive -LiteralPath ${quote(srcZip)} -DestinationPath ${quote(work)} -Force`)

    const secrets = readdirSync(work).filter((n) => n.startsWith('.env') && n !== '.env.example')
    for (const f of secrets) rmSync(join(work, f), { force: true, recursive: true })

    const items = readdirSync(work).map((n) => join(work, n))
    if (items.length === 0) throw new Error('解壓後沒有任何檔案')

    rmSync(outZip, { force: true })
    // Compress-Archive 的目的檔必須以 .zip 結尾，否則會失敗
    runPs(
      `Compress-Archive -LiteralPath ${items.map(quote).join(',')} ` +
        `-DestinationPath ${quote(outZip)} -Force`,
    )

    // 確認真的產生了才算成功
    if (!existsSync(outZip) || statSync(outZip).size === 0) {
      throw new Error('輸出的 zip 不存在或是空的')
    }

    if (secrets.length > 0) {
      console.log(`✔ ${name}（移除 ${secrets.join('、')}）`)
      cleaned++
    } else {
      console.log(`· ${name}（本來就沒有憑證）`)
      copied++
    }
  } catch (err) {
    console.error(`✘ ${name}：${String(err.message).split('\n')[0]}`)
    failed++
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

console.log(`\n完成：清理 ${cleaned} 個，原本就乾淨 ${copied} 個，失敗 ${failed} 個`)
console.log(`來源未被修改：${src}`)
