/**
 * 權限模型驗收測試（純邏輯 + 開發資料庫）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-permissions.ts
 *
 * 檢查：五種角色的權限矩陣符合最終版設計、未知角色退回只讀人員、金額遮罩、最後一位擁有者保護計數。
 * 會建立 TEST_perm_ 開頭的後台帳號並於結束時刪除。不要對正式庫執行。
 */
import { mainPrisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/admin-auth'
import { ALL_PERMISSIONS, ASSIGNABLE_ROLES, can, canDo, permissionsOf, ROLE_PERMISSIONS, type Permission } from '../src/lib/admin-permissions'
import { maskOrderDetailAmounts, maskOrderListAmounts, type OrderDetail, type OrderListResult } from '../src/server/admin-orders'
import { countOtherActiveSuperAdmins } from '../src/server/staff-actions'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const all = (r: string, ps: Permission[]) => ps.every((p) => can(r, p))
  const none = (r: string, ps: Permission[]) => ps.every((p) => !can(r, p))
  const sensitive: Permission[] = ['staff', 'refund', 'settings', 'audit', 'members', 'members.note', 'members.restrict', 'access.password']
  const three = ['SUPER_ADMIN', 'MANAGER', 'ENGINEER'] as const
  check('高級管理者擁有全部權限', all('SUPER_ADMIN', ALL_PERMISSIONS))
  check('一般管理者可查看場地預約、訂單紀錄', all('MANAGER', ['bookings', 'bookings.manage', 'courts', 'courts.manage', 'checkin', 'activities.view']))
  check('一般管理者不再有財務、報表、會員與教練權限', none('MANAGER', ['finance', 'reports', 'members', 'members.note', 'members.restrict']))
  check('一般管理者的門禁設備與授權僅能查看，不能操作', can('MANAGER', 'access') && none('MANAGER', ['access.grant', 'access.remote', 'access.schedule', 'access.password', 'access.alerts']))
  check('一般管理者不能訪問無人營運管理、AI 即時監控、系統設定', none('MANAGER', ['monitor', 'device', 'settings', 'staff', 'audit']))
  check('工程管理者可訪問無人營運管理、AI 即時監控，並可處理門禁異常事件', all('ENGINEER', ['monitor', 'device', 'access', 'camera.playback', 'device.control', 'access.alerts']))
  check('工程管理者不能建立門禁授權、遠端開門、排程或設定密碼', none('ENGINEER', ['access.grant', 'access.remote', 'access.schedule', 'access.password']))
  check('工程管理者不能訪問場地預約、訂單紀錄、財務報表、會員與教練、系統設定', none('ENGINEER', ['bookings', 'bookings.manage', 'courts', 'courts.manage', 'activities.view', 'checkin', 'finance', 'reports', 'members', 'settings', 'staff', 'audit']))
  check('系統設定只有高級管理者可訪問', can('SUPER_ADMIN', 'settings') && can('SUPER_ADMIN', 'staff') && can('SUPER_ADMIN', 'audit') && none('MANAGER', ['settings', 'staff', 'audit']) && none('ENGINEER', ['settings', 'staff', 'audit']))
  check('敏感操作：只有高級管理者能執行', three.filter((r) => r !== 'SUPER_ADMIN').every((r) => sensitive.every((p) => !can(r, p))))
  check('可指派角色不含高級管理者', !ASSIGNABLE_ROLES.includes('SUPER_ADMIN'))
  check('門禁授權 = 門禁權限模組的「門禁授權」動作', three.every((r) => can(r, 'access.grant') === canDo(r, 'access', 'door')))
  check('門禁異常事件處理 = 門禁權限模組的「異常事件」動作', three.every((r) => can(r, 'access.alerts') === canDo(r, 'access', 'approve')))
  check('退款核准 = 訂單財務模組的「審核」動作', three.every((r) => can(r, 'refund') === canDo(r, 'finance', 'approve')))
  check('未知角色字串退回一般管理者權限', permissionsOf('HACKER').join() === ROLE_PERMISSIONS.MANAGER.join())
  // 5. 金額遮罩
  const list = { query: {}, total: 1, pages: 1, queriedAt: '', amountsHidden: false, rows: [{ id: 'x', total: 1200, refundedAmount: 300 }] } as unknown as OrderListResult
  const masked = maskOrderListAmounts(list)
  check('訂單列表遮罩：金額清 0 並標記 amountsHidden', masked.amountsHidden && masked.rows[0].total === 0 && masked.rows[0].refundedAmount === 0 && list.rows[0].total === 1200)
  const detail = {
    amountsHidden: false,
    customer: { points: 50 },
    amounts: { subtotal: 1000, discount: 100, pointsUsed: 20, total: 880, refundedAmount: 0, voucherCode: null },
    courtItems: [{ price: 500, refundedAmount: 0, refundedPoints: 0 }],
    activityItems: [{ unitPrice: 300, amount: 600, refundedAmount: 0, refundedPoints: 0 }],
    payments: [{ amount: 880, card: '****1234', providerRef: 'ref' }],
    refunds: [{ cashAmount: 100, pointsAmount: 5 }],
    invoices: [{ amount: 880 }],
  } as unknown as OrderDetail
  const md = maskOrderDetailAmounts(detail)
  check('訂單明細遮罩：所有金額、卡號、交易編號、點數清除', md.amountsHidden && md.amounts.total === 0 && md.courtItems[0].price === 0 && md.activityItems[0].amount === 0 && md.payments[0].amount === 0 && md.payments[0].card === null && md.payments[0].providerRef === null && md.refunds[0].cashAmount === 0 && md.invoices[0].amount === 0 && md.customer.points === 0)
  // 6. 最後一位高級管理者保護（計數）
  await cleanup()
  const pw = await hashPassword('TEST_perm_password_12345')
  const s1 = await mainPrisma.adminAccount.create({ data: { username: 'TEST_perm_superadmin1', usernameKey: 'test_perm_superadmin1', displayName: 's1', passwordHash: pw, role: 'SUPER_ADMIN', tenant: 'main' } })
  const s2 = await mainPrisma.adminAccount.create({ data: { username: 'TEST_perm_superadmin2', usernameKey: 'test_perm_superadmin2', displayName: 's2', passwordHash: pw, role: 'SUPER_ADMIN', tenant: 'main', active: false } })
  const realSuperAdmins = await mainPrisma.adminAccount.count({ where: { role: 'SUPER_ADMIN', active: true, tenant: 'main', id: { notIn: [s1.id, s2.id] } } })
  const others = await countOtherActiveSuperAdmins(s1.id)
  check('停用的高級管理者不計入「其他有效高級管理者」', others === realSuperAdmins, `others=${others}, real=${realSuperAdmins}`)
  const stored = await mainPrisma.adminAccount.findUniqueOrThrow({ where: { id: s1.id } })
  check('密碼以 scrypt 雜湊保存，不含明文', stored.passwordHash.startsWith('scrypt$') && !stored.passwordHash.includes('TEST_perm_password'))
  check('新帳號預設 mustChangePassword 可由建立流程設定', stored.mustChangePassword === false)
}

async function cleanup() {
  const accs = await mainPrisma.adminAccount.findMany({ where: { username: { startsWith: 'TEST_perm_' } }, select: { id: true } })
  if (accs.length === 0) return
  await mainPrisma.adminSession.deleteMany({ where: { accountId: { in: accs.map((a) => a.id) } } })
  await mainPrisma.adminAccount.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } })
}

main()
  .catch((err) => {
    console.error(err)
    results.push({ name: '執行', ok: false, detail: String(err) })
  })
  .finally(async () => {
    await cleanup()
    const ok = results.filter((r) => r.ok).length
    console.log(`\n通過 ${ok}／${results.length}`)
    process.exit(ok === results.length ? 0 : 1)
  })
