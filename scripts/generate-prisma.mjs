/**
 * prisma generate + 修補，且修補一定會執行。
 *
 * 專案在 Dropbox 內，dev server 執行中時會鎖住 query engine 的 DLL，
 * 使 prisma generate 以 EPERM 失敗；但此時 JS 檔其實已經重新產生，
 * 若因失敗而跳過修補，client 就會壞在 #main-entry-point。
 * 因此這裡無論 generate 成敗都跑修補，再回報原始結果。
 */
import { spawnSync } from 'node:child_process'

const generate = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true })
const patch = spawnSync('node', ['scripts/patch-prisma-client.mjs'], { stdio: 'inherit', shell: true })

if (generate.status !== 0) {
  console.error('\n⚠️  prisma generate 未成功結束。')
  console.error('   若錯誤為 EPERM / rename query_engine，請先停掉 dev server 再重跑。')
}
process.exit(generate.status ?? patch.status ?? 1)
