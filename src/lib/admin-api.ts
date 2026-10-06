import 'server-only'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getAdminUser } from './admin-auth'
import { prisma } from './db'

/** 後台 API 共用：統一的錯誤回應與登入檢查。 */

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', '請先登入')
export const badRequest = (message: string) => apiError(400, 'BAD_REQUEST', message)
export const notFound = (message = '找不到資料') => apiError(404, 'NOT_FOUND', message)

/** 回傳登入的管理者帳號；未登入回 null，呼叫端自行回 unauthorized()。 */
export async function requireAdminApi(): Promise<string | null> {
  return getAdminUser()
}

export async function readJson<T>(req: Request): Promise<T | null> {
  return (await req.json().catch(() => null)) as T | null
}

/**
 * 產生流水號，例如 EXP-2026-0007。以同年份既有筆數 + 1 編號；
 * 並行建立時可能撞號，由 @unique 擋下後重試一次。
 */
export async function nextNumber(prefix: 'EXP' | 'RCP' | 'INV', countThisYear: () => Promise<number>): Promise<string> {
  const year = new Date().getFullYear()
  const n = (await countThisYear()) + 1
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`
}

export async function audit(actor: string, action: string, target: string, detail?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actor, action, target, detail: detail ? (detail as Prisma.InputJsonValue) : undefined } })
}

export const toInt = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null
}

export const toDateOrNull = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
