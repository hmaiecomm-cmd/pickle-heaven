/**
 * 即時監控驗證（只在開發資料庫執行；攝影機設定與操作紀錄在結束時還原）
 *   npm run verify:camera
 */
import { prisma } from '../src/lib/db'
import { can } from '../src/lib/admin-permissions'
import { CAMERA_IDS, DEFAULT_CAMERAS, DEMO_MEDIA, conePath, stepCamera } from '../src/lib/camera-layout'
import { PLAN_HEIGHT, PLAN_WIDTH, VENUE_ZONES } from '../src/lib/venue-layout'

if (!/^libsql:\/\/pickle-heaven-dev-/.test(process.env.TURSO_DATABASE_URL ?? '')) {
  console.error('中止：只能在開發資料庫執行')
  process.exit(1)
}

let passed = 0
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) passed++
  else failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? `（${extra}）` : ''}`)
}

// 模擬伺服器上已設定攝影機密碼，確認不會出現在任何回傳資料中
const SECRET = 'S3cret-Cam-Pass-9'
process.env.TEST_CAMERA_SECRET = SECRET
const ACTOR = 'admin:camera-test'

async function main() {
  const svc = await import('../src/server/camera-service')
  const saved = await prisma.monitorCamera.findMany()

  console.log('── 預設攝影機')
  check('共 6 支，編號 01–06', DEFAULT_CAMERAS.length === 6 && CAMERA_IDS.join(',') === '01,02,03,04,05,06')
  const names = Object.fromEntries(DEFAULT_CAMERAS.map((c) => [c.id, c.name]))
  check('名稱依需求：球場A中央、球場A側邊、室內休息區、門口休息區、球場B中央、出入口／大門', names['01'] === '球場 A－中央' && names['02'] === '球場 A－側邊' && names['03'] === '室內休息區' && names['04'] === '門口休息區' && names['05'] === '球場 B－中央' && names['06'] === '出入口／大門')
  check('位置都在平面圖內、區域存在', DEFAULT_CAMERAS.every((c) => c.x > 0 && c.x < PLAN_WIDTH && c.y > 0 && c.y < PLAN_HEIGHT && VENUE_ZONES.some((z) => z.id === c.zone)))
  check('拍攝範圍可繪製', DEFAULT_CAMERAS.every((c) => /^M [\d.]+ [\d.]+ L .+ Z$/.test(conePath(c))))
  check('只有 03、04 有示範影像', Object.keys(DEMO_MEDIA).sort().join(',') === '03,04')

  console.log('── 六路切換順序')
  const ids = [...CAMERA_IDS]
  const seq: string[] = []
  let cur: (typeof CAMERA_IDS)[number] = '01'
  for (let i = 0; i < 6; i++) seq.push((cur = stepCamera(ids, cur, 1)))
  check('下一支依序走完 6 支並回到 01', seq.join(',') === '02,03,04,05,06,01')
  check('上一支：01 → 06', stepCamera(ids, '01', -1) === '06')

  console.log('── 權限（後端）')
  check('查看即時影像：擁有者、管理員、營運、只讀；櫃台不行', ['OWNER', 'MANAGER', 'OPERATOR', 'VIEWER'].every((r) => can(r, 'monitor')) && !can('FRONTDESK', 'monitor'))
  check('歷史回放：擁有者、管理員、營運；只讀與櫃台不行', ['OWNER', 'MANAGER', 'OPERATOR'].every((r) => can(r, 'camera.playback')) && !can('VIEWER', 'camera.playback') && !can('FRONTDESK', 'camera.playback'))
  check('下載影像與截圖：只限擁有者、管理員', can('OWNER', 'camera.export') && can('MANAGER', 'camera.export') && !['OPERATOR', 'FRONTDESK', 'VIEWER'].some((r) => can(r, 'camera.export')))
  check('管理攝影機：只限擁有者、管理員', can('OWNER', 'camera.manage') && can('MANAGER', 'camera.manage') && !['OPERATOR', 'FRONTDESK', 'VIEWER'].some((r) => can(r, 'camera.manage')))
  check('處理事件：擁有者、管理員、營運；只讀不行', ['OWNER', 'MANAGER', 'OPERATOR'].every((r) => can(r, 'monitor.events')) && !can('VIEWER', 'monitor.events'))

  console.log('── Demo Mode')
  const owner = await svc.listCameras('OWNER')
  check('資料表可用', owner.storage === 'ready')
  check('攝影機狀態全部為未連線（不假裝在線）', owner.cameras.every((c) => c.state === 'NOT_CONNECTED' || c.state === 'DISABLED'))
  const pb = await svc.getPlayback('03', '2026-11-12', 'OWNER')
  check('歷史回放沒有錄影片段、標示未連線', pb.connected === false && pb.segments.length === 0)
  check('事件只來自系統偵測（不產生假事件）', (await svc.listMonitorEvents()).every((e) => typeof e.id === 'string' && e.createdAt.length > 0))

  console.log('── 攝影機設定與驗證')
  const base = { name: '室內休息區', zone: 'dining', x: 99, y: 19.5, facing: 165, coverage: '室內休息區座位', enabled: true, protocol: 'NVR' as const, host: '192.168.1.20', port: 554, channel: '301', credentialEnv: 'TEST_CAMERA_SECRET', viewRoles: ['MANAGER', 'OPERATOR'] as ('MANAGER' | 'OPERATOR' | 'VIEWER')[] }
  const updated = await svc.updateCamera('03', base, ACTOR)
  check('儲存名稱、區域、串流設定', updated.name === '室內休息區' && updated.protocol === 'NVR' && updated.host === '192.168.1.20' && updated.channel === '301')
  check('憑證只回報「已設定」，不回傳內容', updated.credentialPresent === true && !JSON.stringify(updated).includes(SECRET))
  const viewer = await svc.listCameras('VIEWER')
  check('觀看權限：取消只讀人員後，只讀人員看不到 Camera 03', !viewer.cameras.some((c) => c.id === '03') && viewer.cameras.length === 5)
  check('擁有者一律看得到', (await svc.listCameras('OWNER')).cameras.some((c) => c.id === '03'))
  let blocked = false
  try {
    await svc.getPlayback('03', '2026-11-12', 'VIEWER')
  } catch {
    blocked = true
  }
  check('沒有觀看權限時，伺服器拒絕回放', blocked)
  const all = JSON.stringify([await svc.listCameras('OWNER'), await svc.listCamerasForAdmin()])
  check('任何回傳資料都不含密碼', !all.includes(SECRET))
  const reject = async (patch: Partial<typeof base>) => {
    try {
      await svc.updateCamera('03', { ...base, ...patch } as typeof base, ACTOR)
      return false
    } catch {
      return true
    }
  }
  check('主機含帳號密碼 → 擋下', await reject({ host: 'admin:pass@192.168.1.20' }))
  check('通道含 rtsp:// 或 password → 擋下', (await reject({ channel: 'rtsp://admin:x@1.2.3.4/stream' })) && (await reject({ channel: 'ch1?password=abc' })))
  check('憑證變數名稱格式錯誤 → 擋下', await reject({ credentialEnv: 'my password' }))
  check('名稱空白 → 擋下', await reject({ name: '  ' }))
  check('平面圖座標超出範圍 → 擋下', await reject({ x: 500 }))

  const t = await svc.testCameraConnection('03', ACTOR)
  check('連線測試不會回報「成功」，並說明尚未建置串流閘道', t.ok === false && /尚未建置串流閘道/.test(t.result))
  await svc.updateCamera('03', { ...base, credentialEnv: 'MISSING_CAMERA_ENV_X' }, ACTOR)
  const t2 = await svc.testCameraConnection('03', ACTOR)
  check('憑證環境變數不存在 → 明確提示', /尚未設定憑證環境變數/.test(t2.result))
  const audit = await prisma.auditLog.count({ where: { actor: ACTOR, action: { in: ['CAMERA_UPDATE', 'CAMERA_TEST'] } } })
  check('修改與測試都寫入操作紀錄', audit >= 4, `${audit} 筆`)

  // 還原
  await prisma.monitorCamera.deleteMany({ where: { id: { notIn: saved.map((s) => s.id) } } })
  for (const s of saved) await prisma.monitorCamera.update({ where: { id: s.id }, data: s })
  await prisma.auditLog.deleteMany({ where: { actor: ACTOR } })
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
