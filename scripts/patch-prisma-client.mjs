/**
 * 修補 Prisma 產生的 client。
 *
 * 本專案路徑含中文（匹克天堂平台系統），而 Node 在 Windows 上無法解析
 * 非 ASCII 路徑底下 package.json 的 imports 子路徑（#xxx）。
 * Prisma 6.19 產生的 default.js 用 require('#main-entry-point')，因此會壞掉。
 * 這裡把它改回等效的相對路徑。prisma generate 之後都要跑一次。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const target = new URL('../node_modules/.prisma/client/default.js', import.meta.url)

if (!existsSync(target)) {
  console.log('[patch-prisma] 找不到產生的 client，略過。')
  process.exit(0)
}

const src = readFileSync(target, 'utf8')
if (!src.includes('#main-entry-point')) {
  console.log('[patch-prisma] 已是修補後狀態，略過。')
  process.exit(0)
}

writeFileSync(target, src.replace("require('#main-entry-point')", "require('./index.js')"))
console.log('[patch-prisma] 已修補 #main-entry-point → ./index.js')
