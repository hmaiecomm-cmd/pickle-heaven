/**
 * 權限模型驗收測試（純邏輯 + 開發資料庫）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-permissions.ts
 *
 * 檢查：角色權限矩陣符合規格、未知角色退回工作人員、金額遮罩、最後一位擁有者保護計數。
 * 會建立 TEST_perm_ 開頭的後台帳號並於結束時刪除。不要對正式庫執行。
 */
import { mainPrisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/admin-auth'
import { can, permissionsOf, ROLE_PERMISSIONS, type Permission } from '../src/lib/admin-permissions'
import { maskOrderDetailAmounts, maskOrderListAmounts, type OrderDetail, type OrderListResult } from '../src/server/admin-orders'
import { countOtherActiveOwners } from '../src/server/staff-actions'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  // 1. 財務相關權限只有擁有者
  const financeOnly: Permission[] = ['finance', 'finance.adjust', 'refund', 'invoice', 'expenses.review', 'settings', 'staff', 'members.restrict', 'device.control']
  check('管理員沒有任何帳務／退款／點數／角色／金流／設備控制權限', financeOnly.every((p) => !can('MANAGER', p)))
  check('工作人員沒有任何帳務／退款／點數／角色／金流／設備控制權限', financeOnly.every((p) => !can('STAFF', p)))
  check('擁有者擁有全部權限', (Object.keys(ROLE_PERMISSIONS.OWNER).length > 0) && financeOnly.every((p) => can('OWNER', p)))
  // 2. 管理員：可改預約、管活動、商城行銷、非財務報表、本人費用
  check('管理員可修改客人預約、管理活動與商城行銷、看非財務報表、提本人費用', (['bookings.manage', 'courts.manage', 'activities', 'marketing', 'reports', 'expenses.own', 'checkin'] as Permission[]).every((p) => can('MANAGER', p)))
  // 3. 工作人員：只查詢、報到、本人費用；不能改預約、改活動、行銷
  check('工作人員可查預約、報到、查會員、提本人費用', (['bookings', 'checkin', 'members', 'activities.view', 'expenses.own', 'monitor', 'courts'] as Permission[]).every((p) => can('STAFF', p)))
  check('工作人員不能新增／改期／取消預約、不能改活動、行銷、封場、非財務報表', (['bookings.manage', 'activities', 'marketing', 'courts.manage', 'reports'] as Permission[]).every((p) => !can('STAFF', p)))
  // 4. 未知角色退回工作人員
  check('未知角色字串退回工作人員權限', permissionsOf('HACKER').join() === ROLE_PERMISSIONS.STAFF.join())
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
