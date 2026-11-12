/**
 * 即時監控驗證（只讀，不寫入資料庫）
 *   npm run verify:camera
 */
import { can } from '../src/lib/admin-permissions'
import { CAMERAS, CAMERA_IDS, conePath, stepCamera } from '../src/lib/camera-layout'
import { PLAN_HEIGHT, PLAN_WIDTH, VENUE_ZONES } from '../src/lib/venue-layout'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) passed++
  else failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? `（${extra}）` : ''}`)
}

// 模擬日後在環境變數放了攝影機憑證，確認不會出現在回傳資料中
const SECRET = 'rtsp://admin:S3cret-Pass@10.0.0.9:554/stream1'
process.env.CAMERA_RTSP_URL = SECRET
process.env.NVR_PASSWORD = 'S3cret-Pass'

async function main() {
  console.log('── 攝影機配置')
  check('共 6 支，編號 1–6', CAMERAS.length === 6 && CAMERA_IDS.join(',') === '1,2,3,4,5,6')
  check('代號為 Camera 1–6', CAMERAS.every((c) => c.code === `Camera ${c.id}`))
  check('位置都在平面圖內', CAMERAS.every((c) => c.x > 0 && c.x < PLAN_WIDTH && c.y > 0 && c.y < PLAN_HEIGHT))
  const zoneIds = new Set(VENUE_ZONES.map((z) => z.id))
  check('所屬區域都存在', CAMERAS.every((c) => zoneIds.has(c.zone)))
  check('拍攝範圍可繪製', CAMERAS.every((c) => /^M [\d.]+ [\d.]+ L .+ Z$/.test(conePath(c))))

  console.log('── 主畫面切換')
  check('下一支：1 → 2、6 → 1', stepCamera(1, 1) === 2 && stepCamera(6, 1) === 1)
  check('上一支：1 → 6、4 → 3', stepCamera(1, -1) === 6 && stepCamera(4, -1) === 3)

  console.log('── Demo Mode 與憑證')
  const { getCameraOverview } = await import('../src/server/camera-service')
  const o = await getCameraOverview()
  check('未串接 → 標示 Demo Mode、未連線', o.integration.connected === false && o.integration.label === 'Demo Mode')
  check('攝影機狀態全部為「未連線」，不假裝在線', o.cameras.every((c) => c.state === 'NOT_CONNECTED' && c.lastSeen === null))
  const json = JSON.stringify(o)
  check('回傳資料不含環境變數中的憑證', !json.includes('S3cret') && !json.includes('rtsp://'))
  check('回傳資料沒有串流網址欄位', !/"(url|streamUrl|rtsp|password|token|username)"/i.test(json))
  check('異常事件只列未處理項目', o.events.every((e) => e.status === 'OPEN' || e.status === 'ACKED'), `${o.events.length} 筆`)

  console.log('── 權限')
  check('五種角色中櫃台人員以外都能看即時監控', ['OWNER', 'MANAGER', 'OPERATOR', 'VIEWER'].every((r) => can(r, 'monitor')) && !can('FRONTDESK', 'monitor'))
  check('影像匯出只限擁有者、管理員', can('OWNER', 'camera.export') && can('MANAGER', 'camera.export') && !['OPERATOR', 'FRONTDESK', 'VIEWER'].some((r) => can(r, 'camera.export')))
}

main()
  .catch((e) => {
    failed++
    console.error('❌ 執行錯誤', e)
  })
  .finally(() => {
    console.log(`\n結果：${passed} 通過，${failed} 失敗`)
    process.exit(failed ? 1 : 0)
  })
