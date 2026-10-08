/**
 * 費用與收據驗收測試（直接呼叫後端服務，對開發資料庫執行）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-expenses.ts
 *
 * 以虛擬的管理者 context 執行（不經 HTTP）；建立 TEST_exp_ 開頭的資料並於結束時刪除。不要對正式庫執行。
 */
import sharp from 'sharp'
import { prisma } from '../src/lib/db'
import type { AdminContext } from '../src/lib/admin-auth'
import { permissionsOf } from '../src/lib/admin-permissions'
import { createExpense, deleteLooseAttachment, ExpenseError, findDuplicateHints, loadAttachment, rotateAttachment, setExpenseStatus, storeAttachment, updateExpense } from '../src/server/expense-service'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const ctxOf = (username: string, role: 'OWNER' | 'MANAGER' | 'STAFF'): AdminContext => ({ accountId: `acc-${username}`, username, displayName: username, role, tenant: 'main', sessionId: 's', permissions: permissionsOf(role), mustChangePassword: false, venueId: null })
const owner = ctxOf('TEST_exp_owner', 'OWNER')
const staff = ctxOf('TEST_exp_staff', 'STAFF')
const other = ctxOf('TEST_exp_other', 'MANAGER')
const errCode = async (fn: () => Promise<unknown>) => { try { await fn(); return 0 } catch (e) { return e instanceof ExpenseError ? e.status : -1 } }

async function pngFile(w: number, h: number, name = 'receipt.png'): Promise<File> {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 180, b: 240 } } }).png().toBuffer()
  return new File([new Uint8Array(buf)], name, { type: 'image/png' })
}

async function main() {
  await cleanup()
  // 1. 附件：型別與大小驗證、圖片壓縮與縮圖、PDF 驗證
  const bad = await errCode(() => storeAttachment(new File([new Uint8Array(3000)], 'x.gif', { type: 'image/gif' }), staff))
  check('不接受的檔案型別被拒', bad === 400)
  const fakePdf = await errCode(() => storeAttachment(new File([new Uint8Array(3000)], 'x.pdf', { type: 'application/pdf' }), staff))
  check('內容不是 PDF 的檔案被拒', fakePdf === 400)
  const a1 = await storeAttachment(await pngFile(1200, 1800), staff)
  check('圖片上傳：轉為 WebP、產生縮圖、記錄尺寸', a1.mime === 'image/webp' && a1.hasThumb && a1.width === 1200 && a1.height === 1800)
  // 2. 私有讀取：本人與擁有者可讀，其他人 403
  const full = await loadAttachment(a1.id, staff, 'full')
  const thumb = await loadAttachment(a1.id, owner, 'thumb')
  check('上傳者本人與擁有者可讀附件（含縮圖）', full.mime === 'image/webp' && full.data.length > 0 && thumb.data.length < full.data.length)
  check('其他管理員讀取他人附件被拒（403）', (await errCode(() => loadAttachment(a1.id, other, 'full'))) === 403)
  // 3. 旋轉
  const rot = await rotateAttachment(a1.id, staff, 90)
  check('旋轉 90 度後寬高互換', rot.width === 1800 && rot.height === 1200)
  // 4. 建立費用：附件與費用同交易；他人附件不能綁定；防重複提交
  const key = `TEST_exp_${Date.now()}`
  const base = { category: 'SUPPLIES' as const, amount: 860, description: 'TEST_exp_耗材', vendorName: 'TEST_exp_商店', expenseDate: new Date('2026-10-01T00:00:00Z'), docNumber: 'TEST-0001' }
  const c1 = await createExpense({ ...base, attachmentIds: [a1.id], status: 'SUBMITTED', idempotencyKey: key }, staff)
  check('工作人員建立費用（提交審核）並綁定附件', c1.expense.status === 'SUBMITTED' && c1.expense.attachments.length === 1 && c1.expense.submittedBy === 'admin:TEST_exp_staff' && /^EXP-\d{4}-\d{4}$/.test(c1.expense.expenseNumber))
  const c2 = await createExpense({ ...base, attachmentIds: [a1.id], status: 'SUBMITTED', idempotencyKey: key }, staff)
  check('同一 idempotencyKey 重複送出不建立第二筆', c2.duplicateSubmit && c2.expense.id === c1.expense.id && (await prisma.expense.count({ where: { description: 'TEST_exp_耗材' } })) === 1)
  const a2 = await storeAttachment(await pngFile(800, 600, 'r2.png'), other)
  const stolen = await errCode(() => createExpense({ ...base, docNumber: null, attachmentIds: [a2.id], idempotencyKey: `${key}-b` }, staff))
  check('不能綁定別人上傳的附件（403），也不會留下費用', stolen === 403 && (await prisma.expense.count({ where: { idempotencyKey: `${key}-b` } })) === 0)
  const ghost = await errCode(() => createExpense({ ...base, docNumber: null, attachmentIds: ['nonexistent'], idempotencyKey: `${key}-c` }, staff))
  check('附件不存在時整筆不建立（不會存了費用卻遺失附件）', ghost === 400 && (await prisma.expense.count({ where: { idempotencyKey: `${key}-c` } })) === 0)
  await deleteLooseAttachment(a2.id, other)
  // 5. 重複提醒：同單據號碼 / 同商家日期金額 → 提醒；只有金額相同 → 不提醒
  const h1 = await findDuplicateHints({ amount: 999, docNumber: 'TEST-0001' }, owner)
  const h2 = await findDuplicateHints({ amount: 860, vendorName: 'TEST_exp_商店', expenseDate: new Date('2026-10-01T05:00:00Z') }, owner)
  const h3 = await findDuplicateHints({ amount: 860, vendorName: '別家', expenseDate: new Date('2026-10-02T00:00:00Z') }, owner)
  check('重複提醒：同單據號碼／同商家＋日期＋金額 → 提醒；僅金額相同 → 不提醒', h1.length === 1 && h1[0].reason === '相同單據號碼' && h2.length === 1 && h3.length === 0)
  // 6. 可見性：他人看不到；擁有者看得到
  check('其他管理員看不到別人的申請（404）', (await errCode(() => updateExpense(c1.expense.id, { amount: 1 }, other))) === 404)
  // 7. 狀態：工作人員不能核准；擁有者退回需原因；退回後本人可改回草稿並修改（留歷史）
  check('工作人員不能核准（403）', (await errCode(() => setExpenseStatus(c1.expense.id, 'APPROVED', staff))) === 403)
  check('退回未填原因被拒', (await errCode(() => setExpenseStatus(c1.expense.id, 'REJECTED', owner, ''))) === 400)
  const rejected = await setExpenseStatus(c1.expense.id, 'REJECTED', owner, '金額與收據不符')
  check('擁有者退回並留下說明', rejected.status === 'REJECTED' && rejected.reviewNote === '金額與收據不符')
  check('送審中／已核准不能由本人修改：退回後可修改', (await errCode(() => updateExpense(c1.expense.id, { amount: 880 }, staff))) === 0)
  const e2 = await setExpenseStatus(c1.expense.id, 'SUBMITTED', staff)
  check('本人修正後重新提交', e2.status === 'SUBMITTED' && e2.amount === 880 && e2.revisions.length === 1)
  const approved = await setExpenseStatus(c1.expense.id, 'APPROVED', owner)
  check('擁有者核准（有附件可不填說明）', approved.status === 'APPROVED' && approved.approvedBy === 'admin:TEST_exp_owner')
  // 8. 已核准：本人不能改；擁有者更正留歷史，狀態維持已核准
  check('已核准的申請本人不能修改', (await errCode(() => updateExpense(c1.expense.id, { amount: 1 }, staff))) === 400)
  const corrected = await updateExpense(c1.expense.id, { amount: 870, note: '收據金額為 870' }, owner)
  check('擁有者更正已核准資料：留存前後值與說明、狀態仍已核准', corrected.status === 'APPROVED' && corrected.amount === 870 && corrected.revisions.length === 2 && corrected.revisions[0].note === '收據金額為 870' && (corrected.revisions[0].before as { amount: number }).amount === 880)
  // 9. 沒附件的費用核准需說明
  const c3 = await createExpense({ category: 'OTHER', amount: 100, description: 'TEST_exp_無附件', status: 'SUBMITTED', idempotencyKey: `${key}-d` }, staff)
  check('沒有附件核准時未填說明被拒', (await errCode(() => setExpenseStatus(c3.expense.id, 'APPROVED', owner))) === 400 && (await setExpenseStatus(c3.expense.id, 'APPROVED', owner, '已核對紙本')).status === 'APPROVED')
}

async function cleanup() {
  const exps = await prisma.expense.findMany({ where: { OR: [{ description: { startsWith: 'TEST_exp_' } }, { submittedBy: { startsWith: 'admin:TEST_exp_' } }] }, select: { id: true } })
  const ids = exps.map((e) => e.id)
  if (ids.length) {
    await prisma.expenseRevision.deleteMany({ where: { expenseId: { in: ids } } })
    await prisma.expenseAttachment.deleteMany({ where: { expenseId: { in: ids } } })
    await prisma.expense.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.expenseAttachment.deleteMany({ where: { uploadedBy: { startsWith: 'admin:TEST_exp_' } } })
  await prisma.auditLog.deleteMany({ where: { actor: { startsWith: 'admin:TEST_exp_' } } })
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
