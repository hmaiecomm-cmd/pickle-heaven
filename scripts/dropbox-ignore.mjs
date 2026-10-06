/**
 * 將 .next 與 node_modules 標記為 Dropbox 忽略（不同步）。
 *
 * Windows 的 Dropbox 以 NTFS 替代資料串流 `com.dropbox.ignored` = 1 判斷忽略；
 * 資料夾被刪除重建後標記會消失，因此 clean-next.mjs 會在清除後呼叫這裡重新標記。
 * 也可單獨執行：npm run dropbox:ignore
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function markDropboxIgnored(dir) {
  if (process.platform !== 'win32') {
    console.log('[dropbox-ignore] 非 Windows，略過（macOS 請用 xattr -w com.dropbox.ignored 1 <dir>）。')
    return
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const stream = `${dir}:com.dropbox.ignored`
  try {
    if (readFileSync(stream, 'utf8').trim() === '1') {
      console.log(`[dropbox-ignore] ${dir} 已標記為忽略。`)
      return
    }
  } catch {}
  writeFileSync(stream, '1')
  console.log(`[dropbox-ignore] 已將 ${dir} 標記為 Dropbox 忽略。`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const name of ['.next', 'node_modules']) {
    markDropboxIgnored(fileURLToPath(new URL('../' + name, import.meta.url)))
  }
}
