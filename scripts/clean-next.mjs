/**
 * 清除 .next 建置快取。
 *
 * 專案位於 Dropbox 內，Dropbox 的同步程序會在 Next 寫入期間鎖住 .next 的檔案，
 * 造成 UNKNOWN（errno -4094）或 ENOENT rename 錯誤，頁面會變成 500。
 * 遇到時先停掉 dev server，再跑這支腳本即可。
 *
 * 根治方式是把專案移出 Dropbox；在那之前這是最可靠的處理方式。
 */
import { rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { markDropboxIgnored } from './dropbox-ignore.mjs'

const dir = new URL('../.next', import.meta.url)

if (!existsSync(dir)) {
  console.log('[clean-next] .next 不存在，略過。')
  markDropboxIgnored(fileURLToPath(dir))
} else {
  try {
    rmSync(dir, { recursive: true, force: true })
    console.log('[clean-next] 已清除 .next')
    // 重建空資料夾並重新標記 Dropbox 忽略，避免 Dropbox 在 Next 寫入時鎖檔
    markDropboxIgnored(fileURLToPath(dir))
  } catch (err) {
    console.error('[clean-next] 清除失敗，請確認 dev server 已停止：', err.message)
    process.exit(1)
  }
}
