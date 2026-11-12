/**
 * 後台管理員權限檢查
 */

export type Permission = 
  | 'courts'
  | 'monitor'
  | 'bookings'
  | 'members'
  | 'settings'
  | 'finance'
  | 'reports'

export function can(role: string | undefined, permission: Permission): boolean {
  if (!role) return false

  const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    OWNER: ['courts', 'monitor', 'bookings', 'members', 'settings', 'finance', 'reports'],
    MANAGER: ['courts', 'monitor', 'bookings', 'members', 'settings', 'reports'],
    STAFF: ['monitor', 'bookings'],
    FINANCE: ['bookings', 'finance', 'reports'],
    MAINTENANCE: ['monitor', 'settings'],
  }

  const rolePermissions = ROLE_PERMISSIONS[role] || []
  return rolePermissions.includes(permission)
}
