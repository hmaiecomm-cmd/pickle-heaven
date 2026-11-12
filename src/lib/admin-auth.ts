/**
 * 後台管理員授權檢查
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromCookie } from './admin-session'

export interface CurrentAdmin {
  adminId: string
  email?: string
  role: string
}

/**
 * 從 request 中取得當前管理員身份
 */
export async function getCurrentAdmin(request?: NextRequest): Promise<CurrentAdmin | null> {
  try {
    const session = await getAdminSessionFromCookie()
    if (!session) {
      return null
    }

    return {
      adminId: session.adminId,
      email: session.email,
      role: session.role,
    }
  } catch (error) {
    console.error('Failed to get current admin:', error)
    return null
  }
}

/**
 * 檢查管理員是否有特定權限
 */
export function hasPermission(role: string, permission: string): boolean {
  const PERMISSIONS: Record<string, string[]> = {
    OWNER: [
      'view_all',
      'manage_admins',
      'manage_venues',
      'manage_circuits',
      'manage_access',
      'view_logs',
      'export_data',
    ],
    MANAGER: [
      'view_all',
      'manage_circuits',
      'manage_access',
      'manage_staff',
      'view_logs',
    ],
    STAFF: [
      'view_circuits',
      'control_circuits',
      'view_access',
      'manage_access',
    ],
    FINANCE: [
      'view_all',
      'view_logs',
      'export_data',
    ],
    MAINTENANCE: [
      'view_circuits',
      'control_circuits',
      'view_logs',
    ],
  }

  const adminPermissions = PERMISSIONS[role] || []
  return adminPermissions.includes(permission)
}

/**
 * 需要認證的 API 路由守衛
 */
export async function requireAuth(
  request: NextRequest,
  requiredRole?: string
): Promise<{ admin: CurrentAdmin } | { error: NextResponse }> {
  const admin = await getCurrentAdmin(request)

  if (!admin) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  if (requiredRole && admin.role !== requiredRole) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      ),
    }
  }

  return { admin }
}

/**
 * 需要特定權限的 API 路由守衛
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<{ admin: CurrentAdmin } | { error: NextResponse }> {
  const admin = await getCurrentAdmin(request)

  if (!admin) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  if (!hasPermission(admin.role, permission)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      ),
    }
  }

  return { admin }
}

/**
 * 記錄敏感操作到 Audit Log
 */
export async function logAuditEvent(
  adminId: string | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        target: resourceType,
        detail: details || null,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

/**
 * 獲取管理員上下文（用於頁面級驗證）
 */
export async function getAdminContext(): Promise<CurrentAdmin | null> {
  return await getCurrentAdmin()
}
