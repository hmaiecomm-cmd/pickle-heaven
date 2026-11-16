/**
 * 會員限制類型定義
 * 用於後台管理和前台驗證的一致性
 */

export const RESTRICTION_TYPES = {
  BLACKLIST: {
    code: 'BLACKLIST',
    label: '黑名單（限制使用）',
    description: '禁止預約、報名活動、下單購買、使用點數',
    icon: '🚫',
    affects: ['booking', 'activity', 'order', 'points'] as const,
    color: 'red',
  },
  NO_ACTIVITY: {
    code: 'NO_ACTIVITY',
    label: '禁止報名活動',
    description: '禁止報名新活動及加入候補，但可預約場地',
    icon: '⛔',
    affects: ['activity'] as const,
    color: 'orange',
  },
  NO_BOOKING: {
    code: 'NO_BOOKING',
    label: '禁止預約',
    description: '禁止新增場地預約，但可報名活動',
    icon: '📅',
    affects: ['booking'] as const,
    color: 'amber',
  },
  NO_ORDER: {
    code: 'NO_ORDER',
    label: '禁止下單',
    description: '禁止新增購物訂單',
    icon: '🛒',
    affects: ['order'] as const,
    color: 'yellow',
  },
  CUSTOM: {
    code: 'CUSTOM',
    label: '自訂限制',
    description: '管理員自訂的特殊限制',
    icon: '⚙️',
    affects: [] as const satisfies readonly RestrictionAction[],
    color: 'gray',
  },
} as const

export type RestrictionType = keyof typeof RESTRICTION_TYPES
export type RestrictionAction = 'booking' | 'activity' | 'order' | 'points'

/**
 * 檢查某個操作是否被特定的限制類型擋住
 */
export function isActionBlocked(restrictionType: RestrictionType, action: RestrictionAction): boolean {
  const config = RESTRICTION_TYPES[restrictionType]
  return (config.affects as readonly string[]).includes(action)
}

/**
 * 獲取限制類型的標籤
 */
export function getRestrictionLabel(type: string): string {
  const config = RESTRICTION_TYPES[type as RestrictionType]
  return config?.label ?? `自訂限制 (${type})`
}

/**
 * 獲取限制類型的描述
 */
export function getRestrictionDescription(type: string): string {
  const config = RESTRICTION_TYPES[type as RestrictionType]
  return config?.description ?? '此限制已被啟用'
}

/**
 * 支援的限制類型列表（用於 UI 下拉選單）
 */
export const RESTRICTION_OPTIONS = Object.entries(RESTRICTION_TYPES)
  .filter(([key]) => key !== 'CUSTOM') // CUSTOM 通常不在下拉選單中
  .map(([, config]) => ({
    value: config.code,
    label: config.label,
    description: config.description,
  }))
