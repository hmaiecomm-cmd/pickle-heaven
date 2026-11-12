/**
 * 後台管理員邀請系統
 *
 * 流程：
 * 1. Owner 建立邀請，生成唯一的邀請 token
 * 2. 邀請信發送給指定 email（包含邀請連結）
 * 3. 受邀者透過 LINE Login 驗證身份
 * 4. 系統檢查邀請有效性：
 *    - token 有效期未過期
 *    - email 相符
 *    - 未被使用過
 * 5. 建立後台使用者帳號並綁定 LINE 身份
 * 6. 邀請標記為已使用
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db'

export interface AdminInvitation {
  id: string
  email: string
  token: string
  role: 'owner' | 'manager' | 'staff' | 'finance' | 'maintenance'
  venueId?: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: Date
  expiresAt: Date
  usedAt?: Date
  usedBy?: string
  createdByAdminId: string
  lineUserId?: string
}

export interface AdminLineBinding {
  id: string
  adminId: string
  lineUserId: string
  lineEmail: string
  linkedAt: Date
  lastLoginAt?: Date
}

/**
 * 生成邀請 token
 * 使用加密隨機數，長度足夠防止暴力破解
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 驗證邀請是否有效
 */
export function validateInvitation(
  invitation: any,
  email: string,
): {
  valid: boolean
  error?: string
} {
  // 檢查狀態
  if (invitation.status === 'revoked') {
    return { valid: false, error: '邀請已撤銷' }
  }

  if (invitation.status === 'accepted') {
    return { valid: false, error: '邀請已被使用' }
  }

  // 檢查有效期
  if (new Date() > new Date(invitation.expiresAt)) {
    return { valid: false, error: '邀請已過期' }
  }

  // 檢查 email 相符
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, error: 'Email 不相符' }
  }

  return { valid: true }
}

/**
 * 建立新的邀請
 */
export async function createInvitation(options: {
  email: string
  role: 'owner' | 'manager' | 'staff' | 'finance' | 'maintenance'
  venueId?: string
  createdByAdminId: string
  expirationDays?: number
}): Promise<any> {
  const token = generateInvitationToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (options.expirationDays || 7) * 24 * 60 * 60 * 1000)

  const invitation = await prisma.adminInvitation.create({
    data: {
      email: options.email.toLowerCase(),
      token: token,
      role: options.role as any,
      venueId: options.venueId || null,
      status: 'pending',
      expiresAt: expiresAt,
      createdByAdminId: options.createdByAdminId,
    },
  })

  return invitation
}

/**
 * 根據 token 查詢邀請
 */
export async function getInvitationByToken(token: string): Promise<any | null> {
  return await prisma.adminInvitation.findUnique({
    where: { token },
  })
}

/**
 * 根據 email 查詢有效的邀請
 */
export async function getInvitationByEmail(email: string): Promise<any | null> {
  const now = new Date()
  return await prisma.adminInvitation.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { gt: now },
    },
  })
}

/**
 * 使用邀請建立新管理員帳號
 */
export async function redeemInvitation(options: {
  invitationId: string
  invitationToken: string
  email: string
  lineUserId: string
  lineEmail: string
  displayName: string
}): Promise<{ adminId: string; success: boolean; error?: string }> {
  try {
    // 1. 查詢邀請
    const invitation = await prisma.adminInvitation.findUnique({
      where: { id: options.invitationId },
    })

    if (!invitation) {
      return { adminId: '', success: false, error: '邀請不存在' }
    }

    // 2. 驗證邀請
    const validation = validateInvitation(invitation, options.email)
    if (!validation.valid) {
      return { adminId: '', success: false, error: validation.error }
    }

    // 3. 建立管理員帳號（使用隨機密碼）
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const adminUser = await prisma.adminUser.create({
      data: {
        username: `admin_${crypto.randomBytes(4).toString('hex')}`,
        passwordHash: tempPassword, // TODO: 使用 bcrypt 加密
        displayName: options.displayName,
        role: invitation.role as any,
        mustChangePassword: true,
      },
    })

    // 4. 綁定 LINE 身份
    await prisma.adminLineBinding.create({
      data: {
        adminId: adminUser.id,
        lineUserId: options.lineUserId,
        lineEmail: options.lineEmail,
        lineDisplayName: options.displayName,
      },
    })

    // 5. 標記邀請為已使用
    await prisma.adminInvitation.update({
      where: { id: options.invitationId },
      data: {
        status: 'accepted',
        usedAt: new Date(),
        usedByAdminId: adminUser.id,
      },
    })

    // 6. 建立 Audit Log
    await prisma.auditLog.create({
      data: {
        adminId: adminUser.id,
        action: 'admin_signup',
        resourceType: 'admin_user',
        resourceId: adminUser.id,
        details: {
          email: options.email,
          lineUserId: options.lineUserId,
        },
      },
    })

    return {
      adminId: adminUser.id,
      success: true,
    }
  } catch (error) {
    console.error('Failed to redeem invitation:', error)
    return {
      adminId: '',
      success: false,
      error: '建立帳號失敗',
    }
  }
}

/**
 * 綁定 LINE 身份到管理員帳號
 */
export async function bindLineIdentity(options: {
  adminId: string
  lineUserId: string
  lineEmail: string
}): Promise<AdminLineBinding> {
  const now = new Date()

  const binding = await prisma.adminLineBinding.create({
    data: {
      adminId: options.adminId,
      lineUserId: options.lineUserId,
      lineEmail: options.lineEmail,
      linkedAt: now,
      lastLoginAt: now,
    },
  })

  return binding as unknown as AdminLineBinding
}

/**
 * 根據 LINE User ID 查詢是否已綁定帳號
 */
export async function getAdminByLineUserId(lineUserId: string): Promise<{ adminId: string } | null> {
  const binding = await prisma.adminLineBinding.findUnique({
    where: { lineUserId },
    select: { adminId: true },
  })

  return binding
}

/**
 * 更新 LINE 登入時間
 */
export async function updateLastLineLogin(adminId: string): Promise<void> {
  await prisma.adminLineBinding.updateMany({
    where: { adminId },
    data: { lastLoginAt: new Date() },
  })

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { lastLoginAt: new Date() },
  })
}

/**
 * 撤銷邀請
 */
export async function revokeInvitation(invitationId: string, revokedByAdminId: string): Promise<void> {
  await prisma.adminInvitation.update({
    where: { id: invitationId },
    data: { status: 'revoked' },
  })

  await prisma.auditLog.create({
    data: {
      adminId: revokedByAdminId,
      action: 'invitation_revoke',
      resourceType: 'admin_invitation',
      resourceId: invitationId,
    },
  })
}

/**
 * 停權管理員帳號
 */
export async function disableAdmin(adminId: string, disabledByAdminId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { status: 'disabled' },
  })

  await prisma.auditLog.create({
    data: {
      adminId: disabledByAdminId,
      action: 'admin_disable',
      resourceType: 'admin_user',
      resourceId: adminId,
    },
  })
}

/**
 * 撤銷 LINE 綁定
 */
export async function revokeLineBinding(adminId: string, revokedByAdminId: string): Promise<void> {
  await prisma.adminLineBinding.deleteMany({
    where: { adminId },
  })

  await prisma.auditLog.create({
    data: {
      adminId: revokedByAdminId,
      action: 'line_binding_revoke',
      resourceType: 'admin_line_binding',
      resourceId: adminId,
    },
  })
}

/**
 * 建立 Audit Log
 */
export async function createAuditLog(options: {
  adminId?: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId: options.adminId,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      details: options.details || null,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    },
  })
}
