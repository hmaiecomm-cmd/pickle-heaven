import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { mainPrisma } from '@/lib/db'
import { hashPassword, issueAdminSession, normalizeUsername, type AdminContext } from '@/lib/admin-auth'
import { ASSIGNABLE_ROLES, can, type AdminRole } from '@/lib/admin-permissions'
import type { LineIdentity } from './admin-line-oauth'

/**
 * 後台邀請與 LINE 綁定。帳號資料一律存在正式資料庫（mainPrisma），與密碼登入同一套帳號。
 *
 * - 只有在本系統綁定的 LINE 帳號能登入後台；未受邀、未綁定一律拒絕。
 * - 邀請只能指派 ASSIGNABLE_ROLES（不含擁有者），任何人都無法透過邀請或綁定把自己升為擁有者。
 * - 邀請碼只存 SHA-256 雜湊，原碼只在建立時顯示一次；過期、已使用、已撤銷都不能再用。
 */

export const INVITE_DEFAULT_HOURS = 72
export const INVITE_MAX_HOURS = 168
const MAX_FAILS_PER_LINE = 5
const MAX_FAILS_PER_IP = 20
const ATTEMPT_WINDOW_MS = 15 * 60_000

export class AdminAccessError extends Error {}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')
const lineKey = (lineUserId: string) => `line:${lineUserId}`

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown>) {
  await mainPrisma.auditLog.create({ data: { actor, action, target, detail: detail as Prisma.InputJsonValue } })
}

export type InviteState = 'PENDING' | 'EXPIRED' | 'USED' | 'REVOKED'
export function inviteState(i: { status: string; expiresAt: Date }, at = new Date()): InviteState {
  if (i.status === 'USED' || i.status === 'REVOKED') return i.status
  return i.expiresAt <= at ? 'EXPIRED' : 'PENDING'
}

// ───────────── 邀請 ─────────────

export async function createInvitation(
  input: { role: string; venueId?: string | null; hours?: number; note?: string | null },
  actor: Pick<AdminContext, 'accountId' | 'username' | 'role'>,
) {
  if (!can(actor.role, 'staff')) throw new AdminAccessError('只有擁有者可以邀請管理員')
  if (!ASSIGNABLE_ROLES.includes(input.role as AdminRole)) throw new AdminAccessError('邀請只能指派管理員或工作人員，不能指派擁有者')
  const hours = input.hours ?? INVITE_DEFAULT_HOURS
  if (!Number.isInteger(hours) || hours < 1 || hours > INVITE_MAX_HOURS) throw new AdminAccessError(`有效期限需介於 1 到 ${INVITE_MAX_HOURS} 小時`)
  if (input.venueId) {
    const venue = await mainPrisma.venue.findUnique({ where: { id: input.venueId }, select: { id: true } })
    if (!venue) throw new AdminAccessError('找不到指定的球館')
  }
  const token = randomBytes(32).toString('base64url')
  const invitation = await mainPrisma.adminInvitation.create({
    data: {
      tokenHash: hashToken(token),
      role: input.role,
      venueId: input.venueId || null,
      note: input.note?.trim().slice(0, 200) || null,
      expiresAt: new Date(Date.now() + hours * 3_600_000),
      createdById: actor.accountId,
      createdBy: actor.username,
    },
  })
  await audit(actor.username, 'ADMIN_INVITE_CREATE', invitation.id, { role: invitation.role, venueId: invitation.venueId, expiresAt: invitation.expiresAt })
  return { invitation, token }
}

export async function findInvitation(token: string) {
  if (!token || token.length > 100) return null
  return mainPrisma.adminInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
}

export async function revokeInvitation(id: string, actor: Pick<AdminContext, 'username' | 'role'>) {
  if (!can(actor.role, 'staff')) throw new AdminAccessError('只有擁有者可以撤銷邀請')
  const inv = await mainPrisma.adminInvitation.findUnique({ where: { id } })
  if (!inv) throw new AdminAccessError('找不到這筆邀請')
  if (inviteState(inv) !== 'PENDING') throw new AdminAccessError('這筆邀請已無法使用，不需要撤銷')
  await mainPrisma.adminInvitation.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor.username } })
  await audit(actor.username, 'ADMIN_INVITE_REVOKE', id, {})
}

/** 以 LINE 身分接受邀請：建立後台帳號並綁定 LINE，回傳登入憑證 */
export async function acceptInvitation(token: string, line: LineIdentity, meta: { ip: string; userAgent: string }) {
  const inv = await findInvitation(token)
  if (!inv) throw new AdminAccessError('邀請連結無效')
  const state = inviteState(inv)
  if (state === 'EXPIRED') throw new AdminAccessError('邀請已過期，請向管理者索取新的邀請')
  if (state === 'USED') throw new AdminAccessError('這個邀請已經被使用過')
  if (state === 'REVOKED') throw new AdminAccessError('這個邀請已被撤銷')
  if (!ASSIGNABLE_ROLES.includes(inv.role as AdminRole)) throw new AdminAccessError('邀請的角色不正確')

  const existing = await mainPrisma.adminLineBinding.findUnique({ where: { lineUserId: line.lineUserId } })
  if (existing && !existing.revokedAt) throw new AdminAccessError('這個 LINE 帳號已綁定其他後台帳號')

  const username = `LINE-${randomBytes(4).toString('hex').toUpperCase()}`
  const account = await mainPrisma.$transaction(async (tx) => {
    // 搶用邀請：同一個邀請只能成功一次
    const claim = await tx.adminInvitation.updateMany({
      where: { id: inv.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'USED', usedAt: new Date() },
    })
    if (claim.count === 0) throw new AdminAccessError('這個邀請已經被使用過')
    const acc = await tx.adminAccount.create({
      data: {
        username,
        usernameKey: normalizeUsername(username),
        displayName: line.displayName,
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        role: inv.role,
        tenant: 'main',
        venueId: inv.venueId,
        createdBy: `invite:${inv.id}`,
      },
    })
    await tx.adminInvitation.update({ where: { id: inv.id }, data: { usedByAccountId: acc.id } })
    if (existing) {
      await tx.adminLineBinding.update({
        where: { id: existing.id },
        data: { accountId: acc.id, displayName: line.displayName, pictureUrl: line.pictureUrl, linkedAt: new Date(), linkedBy: `invite:${inv.id}`, revokedAt: null, revokedBy: null },
      })
    } else {
      await tx.adminLineBinding.create({
        data: { accountId: acc.id, lineUserId: line.lineUserId, displayName: line.displayName, pictureUrl: line.pictureUrl, linkedBy: `invite:${inv.id}` },
      })
    }
    return acc
  })
  await audit(username, 'ADMIN_INVITE_ACCEPT', inv.id, { role: inv.role, venueId: inv.venueId })
  await audit(username, 'ADMIN_LINE_BIND', username, { lineName: line.displayName, via: 'invite' })
  await mainPrisma.adminLoginAttempt.create({ data: { usernameKey: lineKey(line.lineUserId), ip: meta.ip, success: true } })
  const issued = await issueAdminSession(account, meta)
  if (!issued.ok) throw new AdminAccessError(issued.error)
  return { account, token: issued.token }
}

// ───────────── LINE 登入 ─────────────

export async function loginWithLine(line: LineIdentity, meta: { ip: string; userAgent: string }) {
  const key = lineKey(line.lineUserId)
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS)
  const [fails, ipFails] = await Promise.all([
    mainPrisma.adminLoginAttempt.count({ where: { usernameKey: key, success: false, createdAt: { gte: since } } }),
    mainPrisma.adminLoginAttempt.count({ where: { ip: meta.ip, success: false, createdAt: { gte: since } } }),
  ])
  if (fails >= MAX_FAILS_PER_LINE || ipFails >= MAX_FAILS_PER_IP) throw new AdminAccessError('登入失敗次數過多，請 15 分鐘後再試')

  const fail = async (message: string) => {
    await mainPrisma.adminLoginAttempt.create({ data: { usernameKey: key, ip: meta.ip, success: false } })
    return new AdminAccessError(message)
  }
  const binding = await mainPrisma.adminLineBinding.findUnique({ where: { lineUserId: line.lineUserId } })
  if (!binding || binding.revokedAt) throw await fail('這個 LINE 帳號尚未綁定後台帳號，請向擁有者索取邀請')
  const account = await mainPrisma.adminAccount.findUnique({ where: { id: binding.accountId } })
  if (!account) throw await fail('找不到綁定的後台帳號')

  const issued = await issueAdminSession(account, meta)
  if (!issued.ok) throw await fail(issued.error)
  await mainPrisma.adminLoginAttempt.create({ data: { usernameKey: key, ip: meta.ip, success: true } })
  await mainPrisma.adminLineBinding.update({ where: { id: binding.id }, data: { lastLoginAt: new Date(), displayName: line.displayName, pictureUrl: line.pictureUrl } })
  return { account, token: issued.token }
}

// ───────────── 綁定與解除 ─────────────

/** 已登入的管理者綁定自己的 LINE */
export async function bindOwnLine(ctx: Pick<AdminContext, 'accountId' | 'username'>, line: LineIdentity) {
  const mine = await mainPrisma.adminLineBinding.findFirst({ where: { accountId: ctx.accountId, revokedAt: null } })
  if (mine) throw new AdminAccessError('你的帳號已綁定 LINE，請先解除綁定再重新綁定')
  const existing = await mainPrisma.adminLineBinding.findUnique({ where: { lineUserId: line.lineUserId } })
  if (existing && !existing.revokedAt) throw new AdminAccessError('這個 LINE 帳號已綁定其他後台帳號')
  const data = { accountId: ctx.accountId, displayName: line.displayName, pictureUrl: line.pictureUrl, linkedAt: new Date(), linkedBy: ctx.username, revokedAt: null, revokedBy: null }
  if (existing) await mainPrisma.adminLineBinding.update({ where: { id: existing.id }, data })
  else await mainPrisma.adminLineBinding.create({ data: { ...data, lineUserId: line.lineUserId } })
  await audit(ctx.username, 'ADMIN_LINE_BIND', ctx.username, { lineName: line.displayName, via: 'self' })
}

/** 解除綁定：本人或擁有者 */
export async function unbindLine(bindingId: string, ctx: Pick<AdminContext, 'accountId' | 'username' | 'role'>) {
  const b = await mainPrisma.adminLineBinding.findUnique({ where: { id: bindingId } })
  if (!b || b.revokedAt) throw new AdminAccessError('找不到這筆綁定')
  if (b.accountId !== ctx.accountId && !can(ctx.role, 'staff')) throw new AdminAccessError('只能解除自己的綁定')
  await mainPrisma.adminLineBinding.update({ where: { id: bindingId }, data: { revokedAt: new Date(), revokedBy: ctx.username } })
  const acc = await mainPrisma.adminAccount.findUnique({ where: { id: b.accountId }, select: { username: true } })
  await audit(ctx.username, 'ADMIN_LINE_UNBIND', acc?.username ?? b.accountId, { lineName: b.displayName })
}

// ───────────── 查詢 ─────────────

export async function listInvitations() {
  return mainPrisma.adminInvitation.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
}

export async function listBindings() {
  const rows = await mainPrisma.adminLineBinding.findMany({ orderBy: { linkedAt: 'desc' }, take: 200 })
  const accounts = await mainPrisma.adminAccount.findMany({ where: { id: { in: rows.map((r) => r.accountId) } }, select: { id: true, username: true, role: true, active: true } })
  const byId = new Map(accounts.map((a) => [a.id, a]))
  return rows.map((r) => ({ ...r, account: byId.get(r.accountId) ?? null }))
}

export async function myBinding(accountId: string) {
  return mainPrisma.adminLineBinding.findFirst({ where: { accountId, revokedAt: null } })
}

/** 登入紀錄（密碼與 LINE）與綁定、邀請操作紀錄 */
export async function loginHistory() {
  const [attempts, actions] = await Promise.all([
    mainPrisma.adminLoginAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    mainPrisma.auditLog.findMany({ where: { action: { startsWith: 'ADMIN_' } }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])
  return { attempts, actions }
}
