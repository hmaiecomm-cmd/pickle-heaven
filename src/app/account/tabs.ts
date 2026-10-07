/** 帳戶頁分頁定義：伺服器與用戶端共用（不含 React 元件） */
export type AccountTab = 'bookings' | 'activities' | 'orders' | 'points' | 'profile'

export const ACCOUNT_TAB_KEYS: AccountTab[] = ['bookings', 'activities', 'orders', 'points', 'profile']

export function isAccountTab(v: string | undefined): v is AccountTab {
  return ACCOUNT_TAB_KEYS.includes(v as AccountTab)
}
