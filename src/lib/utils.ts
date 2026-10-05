import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** NT$ 金額格式化：1200 → "NT$1,200" */
export function ntd(amount: number): string {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

/** 產生訂單編號：PH-20260903-K7Q2 */
export function makeBookingCode(dateStr: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  for (const b of bytes) suffix += alphabet[b % alphabet.length]
  return `PH-${dateStr.replace(/-/g, '')}-${suffix}`
}

/** 台灣手機號碼驗證（09xxxxxxxx 或 +8869xxxxxxxx） */
export function isTwMobile(phone: string): boolean {
  const p = phone.replace(/[\s-]/g, '')
  return /^09\d{8}$/.test(p) || /^\+8869\d{8}$/.test(p)
}

/** 正規化為 09xxxxxxxx */
export function normalizeTwMobile(phone: string): string {
  const p = phone.replace(/[\s-]/g, '')
  return p.startsWith('+886') ? '0' + p.slice(4) : p
}
