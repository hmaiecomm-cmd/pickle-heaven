/**
 * 後台 LINE 登入、邀請與綁定驗證（模擬 LINE API；只在開發資料庫執行，測試資料結束時刪除）
 *   npm run verify:admin-line
 */
process.env.LINE_LOGIN_CHANNEL_ID = 'test-channel'
process.env.LINE_LOGIN_CHANNEL_SECRET = 'test-secret-should-never-leave-server'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

import { createHash } from 'node:crypto'
import { mainPrisma as db } from '../src/lib/db'
import { LineAuthError, completeLogin, createLoginRequest, noticeParams, readLoginRequest, readNotice } from '../src/server/admin-line-oauth'
import { AdminAccessError, acceptInvitation, bindOwnLine, createInvitation, loginWithLine, revokeInvitation, unbindLine } from '../src/server/admin-line-access'

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
async function rejects(name: string, fn: () => Promise<unknown>, msg: RegExp) {
  try {
    await fn()
    check(name, false, '沒有擋下')
  } catch (e) {
    check(name, (e instanceof LineAuthError || e instanceof AdminAccessError) && msg.test(e.message), e instanceof Error ? e.message : String(e))
  }
}

const tag = `lt${Date.now().toString(36)}`
const meta = { ip: '10.0.0.1', userAgent: 'verify-script' }
const created = { invites: [] as string[], accounts: [] as string[], users: [] as string[], lineIds: [] as string[] }
const lineId = (n: string) => {
  const id = `U${tag}${n}`
  created.lineIds.push(id)
  return id
}

/** 模擬 LINE token 與 verify 端點，並記錄送出的內容 */
function fakeLine(claims: Record<string, unknown>) {
  const calls: { url: string; body: URLSearchParams }[] = []
  const impl = (async (url: string, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ''))
    calls.push({ url: String(url), body })
    if (String(url).endsWith('/token')) return new Response(JSON.stringify({ id_token: 'fake.id.token' }), { status: 200 })
    return new Response(JSON.stringify(claims), { status: 200 })
  }) as unknown as typeof fetch
  return { impl, calls }
}

async function main() {
  const owner = await db.adminAccount.findFirst({ where: { role: 'OWNER', tenant: 'main' }, select: { id: true, username: true, role: true } })
  if (!owner) throw new Error('開發資料庫沒有擁有者帳號')
  const ownerCtx = { accountId: owner.id, username: owner.username, role: owner.role as 'OWNER' }

  console.log('── OAuth：state、nonce、PKCE')
  const req1 = await createLoginRequest('login')
  const url = new URL(req1.authorizeUrl)
  const pending = await readLoginRequest(req1.cookie)
  check('授權網址為 Authorization Code Flow（response_type=code、scope=openid profile）', url.searchParams.get('response_type') === 'code' && url.searchParams.get('scope') === 'openid profile')
  check('帶有 state 與 nonce，且與 Cookie 內一致', !!pending && url.searchParams.get('state') === pending.state && url.searchParams.get('nonce') === pending.nonce)
  check('PKCE：code_challenge = SHA-256(verifier)，方法 S256', !!pending && url.searchParams.get('code_challenge') === createHash('sha256').update(pending.verifier).digest('base64url') && url.searchParams.get('code_challenge_method') === 'S256')
  check('Channel Secret 不出現在授權網址', !req1.authorizeUrl.includes('test-secret'))
  check('verifier 不出現在授權網址', !!pending && !req1.authorizeUrl.includes(pending.verifier))
  const req2 = await createLoginRequest('login')
  check('每次登入的 state 都不同（不可預測）', (await readLoginRequest(req2.cookie))!.state !== pending!.state)
  check('Cookie 被竄改 → 無效', (await readLoginRequest(req1.cookie.slice(0, -3) + 'abc')) === null)

  const good = { iss: 'https://access.line.me', aud: 'test-channel', sub: lineId('A'), nonce: pending!.nonce, exp: Math.floor(Date.now() / 1000) + 600, name: '測試甲' }
  await rejects('state 不符 → 拒絕', () => completeLogin({ code: 'c', state: 'wrong' }, pending, fakeLine(good).impl), /state/)
  await rejects('沒有待驗證資料（Cookie 逾時）→ 拒絕', () => completeLogin({ code: 'c', state: pending!.state }, null, fakeLine(good).impl), /逾時/)
  await rejects('使用者在 LINE 按取消 → 拒絕', () => completeLogin({ code: null, state: pending!.state, error: 'access_denied' }, pending, fakeLine(good).impl), /取消/)
  await rejects('ID Token nonce 不符 → 拒絕', () => completeLogin({ code: 'c', state: pending!.state }, pending, fakeLine({ ...good, nonce: 'other' }).impl), /nonce/)
  await rejects('ID Token 對象（aud）不符 → 拒絕', () => completeLogin({ code: 'c', state: pending!.state }, pending, fakeLine({ ...good, aud: 'other-channel' }).impl), /對象/)
  await rejects('ID Token 發行者不符 → 拒絕', () => completeLogin({ code: 'c', state: pending!.state }, pending, fakeLine({ ...good, iss: 'https://evil.example' }).impl), /發行者/)
  await rejects('ID Token 已過期 → 拒絕', () => completeLogin({ code: 'c', state: pending!.state }, pending, fakeLine({ ...good, exp: 1 }).impl), /過期/)
  const fl = fakeLine(good)
  const ident = await completeLogin({ code: 'auth-code', state: pending!.state }, pending, fl.impl)
  check('驗證成功取得 LINE 身分', ident.lineUserId === good.sub && ident.displayName === '測試甲')
  check('換 token 時在伺服器端送出 Channel Secret 與 PKCE verifier', fl.calls[0].body.get('client_secret') === process.env.LINE_LOGIN_CHANNEL_SECRET && fl.calls[0].body.get('code_verifier') === pending!.verifier)
  check('ID Token 交由 LINE 驗證端點驗證，並帶上 nonce', fl.calls[1].url.endsWith('/verify') && fl.calls[1].body.get('nonce') === pending!.nonce)

  console.log('── 頁面提示訊息簽章')
  const n = noticeParams('測試訊息')
  check('伺服器簽過的訊息可以顯示', readNotice(n) === '測試訊息')
  check('自組網址竄改訊息 → 不顯示', readNotice({ ...n, line_error: '請到 evil.example 輸入密碼' }) === null)

  console.log('── 邀請')
  await rejects('邀請擁有者 → 拒絕', () => createInvitation({ role: 'OWNER' }, ownerCtx), /不能指派擁有者/)
  await rejects('非擁有者建立邀請 → 拒絕', () => createInvitation({ role: 'FRONTDESK' }, { ...ownerCtx, role: 'MANAGER' as never }), /只有擁有者/)
  await rejects('有效期限超過 7 天 → 拒絕', () => createInvitation({ role: 'FRONTDESK', hours: 200 }, ownerCtx), /168/)
  const inv = await createInvitation({ role: 'FRONTDESK', hours: 1, note: tag }, ownerCtx)
  created.invites.push(inv.invitation.id)
  check('資料庫只存邀請碼雜湊，不存原碼', inv.invitation.tokenHash !== inv.token && inv.invitation.tokenHash === createHash('sha256').update(inv.token).digest('hex'))

  const lineB = { lineUserId: lineId('B'), displayName: '測試乙', pictureUrl: null }
  const accepted = await acceptInvitation(inv.token, lineB, meta)
  created.accounts.push(accepted.account.id)
  check('接受邀請 → 建立帳號，角色為邀請指定的櫃台人員', accepted.account.role === 'FRONTDESK' && accepted.account.createdBy === `invite:${inv.invitation.id}`)
  check('接受邀請 → 取得登入憑證', typeof accepted.token === 'string' && accepted.token.length > 20)
  check('邀請標記為已使用', (await db.adminInvitation.findUnique({ where: { id: inv.invitation.id } }))?.status === 'USED')
  await rejects('同一個邀請再次使用 → 拒絕', () => acceptInvitation(inv.token, { ...lineB, lineUserId: lineId('B2') }, meta), /使用過/)

  const expired = await createInvitation({ role: 'FRONTDESK', hours: 1, note: tag }, ownerCtx)
  created.invites.push(expired.invitation.id)
  await db.adminInvitation.update({ where: { id: expired.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  await rejects('過期邀請 → 拒絕', () => acceptInvitation(expired.token, { ...lineB, lineUserId: lineId('C') }, meta), /過期/)

  const revoked = await createInvitation({ role: 'MANAGER', hours: 1, note: tag }, ownerCtx)
  created.invites.push(revoked.invitation.id)
  await revokeInvitation(revoked.invitation.id, ownerCtx)
  await rejects('已撤銷邀請 → 拒絕', () => acceptInvitation(revoked.token, { ...lineB, lineUserId: lineId('D') }, meta), /撤銷/)

  const tampered = await createInvitation({ role: 'FRONTDESK', hours: 1, note: tag }, ownerCtx)
  created.invites.push(tampered.invitation.id)
  await db.adminInvitation.update({ where: { id: tampered.invitation.id }, data: { role: 'OWNER' } })
  await rejects('邀請角色被竄改為擁有者 → 拒絕（不能自行升級）', () => acceptInvitation(tampered.token, { ...lineB, lineUserId: lineId('E') }, meta), /角色/)
  await rejects('無效的邀請碼 → 拒絕', () => acceptInvitation('not-a-real-token', { ...lineB, lineUserId: lineId('F') }, meta), /無效/)

  console.log('── LINE 登入')
  await rejects('未綁定、未受邀的 LINE → 拒絕登入', () => loginWithLine({ lineUserId: lineId('X'), displayName: '路人', pictureUrl: null }, meta), /尚未綁定/)
  check('拒絕也寫入登入紀錄', (await db.adminLoginAttempt.count({ where: { usernameKey: `line:${created.lineIds.at(-1)}`, success: false } })) === 1)
  const ok = await loginWithLine(lineB, meta)
  check('已綁定的 LINE → 登入成功', ok.account.id === accepted.account.id && ok.token.length > 20)
  check('登入成功寫入紀錄', (await db.adminLoginAttempt.count({ where: { usernameKey: `line:${lineB.lineUserId}`, success: true } })) >= 2)
  await db.adminAccount.update({ where: { id: accepted.account.id }, data: { active: false } })
  await rejects('帳號停用 → 拒絕登入', () => loginWithLine(lineB, meta), /停用/)
  await db.adminAccount.update({ where: { id: accepted.account.id }, data: { active: true } })

  const member = await db.user.create({ data: { displayName: `${tag}-會員` } })
  created.users.push(member.id)
  await db.memberRestriction.create({ data: { userId: member.id, type: 'BLACKLIST', reason: '測試', createdBy: 'tester' } })
  await db.adminAccount.update({ where: { id: accepted.account.id }, data: { userId: member.id } })
  await rejects('對應會員在黑名單 → 拒絕登入', () => loginWithLine(lineB, meta), /限制使用/)
  await db.adminAccount.update({ where: { id: accepted.account.id }, data: { userId: null } })

  console.log('── 綁定與解除')
  const staffCtx = { accountId: accepted.account.id, username: accepted.account.username, role: 'FRONTDESK' as const }
  await rejects('已綁定的帳號再綁一次 → 拒絕', () => bindOwnLine(staffCtx, { lineUserId: lineId('G'), displayName: '丙', pictureUrl: null }), /先解除/)
  await rejects('LINE 已綁其他帳號 → 不能再綁到擁有者', () => bindOwnLine(ownerCtx, lineB), /已綁定其他/)
  const binding = await db.adminLineBinding.findUnique({ where: { lineUserId: lineB.lineUserId } })
  const other = await db.adminAccount.findFirst({ where: { id: { notIn: [owner.id, accepted.account.id] } }, select: { id: true, username: true } })
  if (other) await rejects('非本人、非擁有者解除別人的綁定 → 拒絕', () => unbindLine(binding!.id, { accountId: other.id, username: other.username, role: 'MANAGER' }), /自己/)
  await unbindLine(binding!.id, ownerCtx)
  await rejects('解除綁定後 → 無法再用 LINE 登入', () => loginWithLine(lineB, meta), /尚未綁定/)
  await bindOwnLine(staffCtx, lineB)
  check('本人重新綁定後可再登入', (await loginWithLine(lineB, meta)).account.id === accepted.account.id)

  const actions = await db.auditLog.findMany({ where: { action: { startsWith: 'ADMIN_' }, OR: [{ actor: { in: [owner.username, accepted.account.username] } }], createdAt: { gte: new Date(Date.now() - 600_000) } }, select: { action: true } })
  const kinds = new Set(actions.map((a) => a.action))
  check('邀請、接受、綁定、解除都有操作紀錄', ['ADMIN_INVITE_CREATE', 'ADMIN_INVITE_REVOKE', 'ADMIN_INVITE_ACCEPT', 'ADMIN_LINE_BIND', 'ADMIN_LINE_UNBIND'].every((k) => kinds.has(k)), [...kinds].join(','))
}

main()
  .catch((e) => {
    failed++
    console.error('❌ 執行錯誤', e)
  })
  .finally(async () => {
    const accounts = await db.adminAccount.findMany({ where: { OR: [{ id: { in: created.accounts } }, { createdBy: { in: created.invites.map((i) => `invite:${i}`) } }] }, select: { id: true, username: true } })
    const ids = accounts.map((a) => a.id)
    await db.adminSession.deleteMany({ where: { accountId: { in: ids } } })
    await db.adminLineBinding.deleteMany({ where: { OR: [{ accountId: { in: ids } }, { lineUserId: { in: created.lineIds } }] } })
    await db.adminLoginAttempt.deleteMany({ where: { usernameKey: { in: created.lineIds.map((l) => `line:${l}`) } } })
    await db.auditLog.deleteMany({ where: { action: { startsWith: 'ADMIN_' }, OR: [{ target: { in: created.invites } }, { actor: { in: accounts.map((a) => a.username) } }, { target: { in: accounts.map((a) => a.username) } }] } })
    await db.adminAccount.deleteMany({ where: { id: { in: ids } } })
    await db.adminInvitation.deleteMany({ where: { id: { in: created.invites } } })
    await db.memberRestriction.deleteMany({ where: { userId: { in: created.users } } })
    await db.user.deleteMany({ where: { id: { in: created.users } } })
    console.log(`\n清除測試資料：帳號 ${ids.length} 個、邀請 ${created.invites.length} 筆、會員 ${created.users.length} 位`)
    console.log(`結果：${passed} 通過，${failed} 失敗`)
    process.exit(failed ? 1 : 0)
  })
