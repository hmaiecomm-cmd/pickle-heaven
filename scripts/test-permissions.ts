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
import { countOtherActiveOwners } from '../src/server/staff-actions'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const all = (r: string, ps: Permission[]) => ps.every((p) => can(r, p))
  const none = (r: string, ps: Permission[]) => ps.every((p) => !can(r, p))
  const sensitive: Permission[] = ['staff', 'refund', 'camera.export', 'access.grant', 'access.remote', 'device.control', 'device.automation']
  const five = ['OWNER', 'MANAGER', 'OPERATOR', 'FRONTDESK', 'VIEWER'] as const
  check('擁有者擁有全部權限', all('OWNER', ALL_PERMISSIONS))
  check('管理員可管理預約、設備、門禁授權、訂單財務（含退款核准與匯出）、報表、系統設定', all('MANAGER', ['bookings.manage', 'device.control', 'device.automation', 'access.grant', 'finance', 'refund', 'finance.export', 'reports', 'settings']))
  check('管理員不能邀請管理員或變更角色', !can('MANAGER', 'staff'))
  check('營運人員可管理預約、看監控、遠端控制設備', all('OPERATOR', ['bookings.manage', 'courts.manage', 'checkin', 'monitor', 'device', 'device.control']))
  check('營運人員門禁只能看、不能授權或遠端開門', can('OPERATOR', 'access') && none('OPERATOR', ['access.grant', 'access.remote']))
  check('營運人員不碰財務、報表、設定、帳號', none('OPERATOR', ['finance', 'refund', 'finance.export', 'reports', 'settings', 'staff']))
  check('櫃台人員可新增／修改預約、報到、查會員', all('FRONTDESK', ['bookings', 'bookings.manage', 'checkin', 'members', 'activities.view']))
  check('櫃台人員不碰監控、設備、門禁、財務、報表、設定', none('FRONTDESK', ['monitor', 'device', 'device.control', 'access', 'access.grant', 'finance', 'refund', 'reports', 'settings', 'staff']))
  check('只讀人員各區可查看', all('VIEWER', ['bookings', 'courts', 'monitor', 'device', 'access', 'finance', 'reports']))
  check('只讀人員不能新增、修改、匯出、控制、授權或使用 AI', none('VIEWER', ['bookings.manage', 'courts.manage', 'checkin', 'activities', 'device.control', 'access.grant', 'finance.export', 'reports.export', 'camera.export', 'expenses.own', 'ai', 'settings', 'staff']))
  check('敏感操作：除擁有者與管理員外，只有營運人員能遠端控制設備', ASSIGNABLE_ROLES.filter((r) => r !== 'MANAGER').every((r) => sensitive.every((p) => !can(r, p) || (r === 'OPERATOR' && p === 'device.control'))))
  check('展示帳號不能邀請管理員或變更角色', !can('DEMO', 'staff'))
  check('可指派角色不含擁有者與展示帳號', !ASSIGNABLE_ROLES.includes('OWNER') && !ASSIGNABLE_ROLES.includes('DEMO'))
  check('門禁授權 = 門禁權限模組的「門禁授權」動作', five.every((r) => can(r, 'access.grant') === canDo(r, 'access', 'door')))
  check('退款核准 = 訂單財務模組的「審核」動作', five.every((r) => can(r, 'refund') === canDo(r, 'finance', 'approve')))
  check('未知角色字串退回只讀人員權限', permissionsOf('HACKER').join() === ROLE_PERMISSIONS.VIEWER.join())
  check('舊的 STAFF 角色不再有任何修改權限', none('STAFF', ['bookings.manage', 'device.control', 'access.grant', 'refund', 'staff']))
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
  // 6. 最後一位擁有者保護（計數）
  await cleanup()
  const pw = await hashPassword('TEST_perm_password_12345')
  const o1 = await mainPrisma.adminAccount.create({ data: { username: 'TEST_perm_owner1', usernameKey: 'test_perm_owner1', displayName: 'o1', passwordHash: pw, role: 'OWNER', tenant: 'main' } })
  const o2 = await mainPrisma.adminAccount.create({ data: { username: 'TEST_perm_owner2', usernameKey: 'test_perm_owner2', displayName: 'o2', passwordHash: pw, role: 'OWNER', tenant: 'main', active: false } })
  const realOwners = await mainPrisma.adminAccount.count({ where: { role: 'OWNER', active: true, tenant: 'main', id: { notIn: [o1.id, o2.id] } } })
  const others = await countOtherActiveOwners(o1.id)
  check('停用的擁有者不計入「其他有效擁有者」', others === realOwners, `others=${others}, real=${realOwners}`)
  const stored = await mainPrisma.adminAccount.findUniqueOrThrow({ where: { id: o1.id } })
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
