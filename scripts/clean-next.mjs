/**
 * 清除 .next 建置快取。
 *
 * 專案位於 Dropbox 內。Dropbox 會鎖住 .next 的檔案（EBUSY / EPERM），
 * 而且一旦 .next 資料夾被刪除重建，Dropbox 的雲端檔案引擎可能搶先接管它，
 * 把它變成 reparse point，dev server 會以 EINVAL readlink 起不來。
 *
 * 因此這支腳本「永遠不刪 .next 本身」：只清空裡面的內容，
 * 讓資料夾上的 Dropbox 忽略標記（com.dropbox.ignored）持續有效。
 * 遇到鎖檔時先停掉 dev server 再跑。
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { markDropboxIgnored } from './dropbox-ignore.mjs'

const dir = fileURLToPath(new URL('../.next', import.meta.url))

if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

let failed = 0
for (const entry of readdirSync(dir)) {
  try {
    rmSync(join(dir, entry), { recursive: true, force: true })
  } catch (err) {
    failed++
    console.error(`[clean-next] 無法刪除 ${entry}：${err.message}`)
  }
}
markDropboxIgnored(dir)

if (failed) {
  console.error('[clean-next] 部分內容未能清除，請確認 dev server 已停止後再跑一次。')
  process.exit(1)
}
console.log('[clean-next] 已清空 .next 內容（資料夾本身保留，忽略標記維持有效）。')
