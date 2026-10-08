import type { ExpenseDTO } from '@/server/expense-service'

/** 費用與收據的前端 API 呼叫（同源、帶登入 cookie；錯誤統一回傳訊息） */

export type ApiResult<T> = { ok: true; data: T; meta?: Record<string, unknown> } | { ok: false; error: string; status: number }

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; meta?: Record<string, unknown>; error?: { message?: string } } | null
    if (!res.ok || !body?.success) return { ok: false, error: body?.error?.message ?? (res.status === 401 ? '請重新登入' : res.status === 403 ? '沒有權限' : '伺服器錯誤'), status: res.status }
    return { ok: true, data: body.data as T, meta: body.meta }
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.message === 'Failed to fetch' ? '網路連線失敗，請檢查網路後重試' : '發生錯誤，請重試', status: 0 }
  }
}
const json = (method: string, payload: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

export const listExpenses = () => call<ExpenseDTO[]>('/api/admin/expenses')
export const getExpenseApi = (id: string) => call<ExpenseDTO>(`/api/admin/expenses/${encodeURIComponent(id)}`)
export const createExpenseApi = (payload: Record<string, unknown>) => call<ExpenseDTO>('/api/admin/expenses', json('POST', payload))
export const updateExpenseApi = (id: string, payload: Record<string, unknown>) => call<ExpenseDTO>(`/api/admin/expenses/${encodeURIComponent(id)}`, json('PATCH', payload))
export const setExpenseStatusApi = (id: string, status: string, note?: string) => call<ExpenseDTO>(`/api/admin/expenses/${encodeURIComponent(id)}/status`, json('PATCH', { status, note }))
export const duplicateHintsApi = (q: { amount: number; vendorName?: string; expenseDate?: string; docNumber?: string; excludeId?: string }) => {
  const p = new URLSearchParams()
  p.set('amount', String(q.amount))
  if (q.vendorName) p.set('vendorName', q.vendorName)
  if (q.expenseDate) p.set('expenseDate', q.expenseDate)
  if (q.docNumber) p.set('docNumber', q.docNumber)
  if (q.excludeId) p.set('excludeId', q.excludeId)
  return call<Array<{ id: string; expenseNumber: string; amount: number; vendorName: string | null; expenseDate: string | null; docNumber: string | null; status: string; reason: string }>>(`/api/admin/expenses/duplicates?${p}`)
}
export interface AttachmentDTO { id: string; mime: string; sizeBytes: number; width: number | null; height: number | null; originalName: string | null; isPdf: boolean; createdAt: string; hasThumb?: boolean; duplicateOfExisting?: boolean }
export const uploadAttachmentApi = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return call<AttachmentDTO>('/api/admin/expenses/attachments', { method: 'POST', body: form })
}
export const rotateAttachmentApi = (id: string, rotate: 90 | 180 | 270) => call<{ id: string }>(`/api/admin/expenses/attachments/${encodeURIComponent(id)}`, json('PATCH', { rotate }))
export const deleteAttachmentApi = (id: string) => call<{ deleted: boolean }>(`/api/admin/expenses/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const attachmentUrl = (id: string, thumb = false, bust = 0) => `/api/admin/expenses/attachments/${encodeURIComponent(id)}${thumb ? '?thumb=1' : '?full=1'}${bust ? `&v=${bust}` : ''}`
