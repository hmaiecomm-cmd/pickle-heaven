'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { requirePermission } from '@/lib/admin-auth'
const requireAdmin = async () => (await requirePermission('activities')).username
import {
  ActivityAdminError,
  addSession,
  applySessionEdit,
  courtAvailabilityForForm,
  previewAddSession,
  removeDraftSession,
  archiveActivity,
  cancelActivitySession,
  previewActivity,
  previewSessionEdit,
  saveActivity,
  syncLegacyOccupancy,
  type EditImpactRow,
  type PreviewResult,
  type SaveResult,
} from './activity-admin'

type R<T> = ({ ok: true; message?: string } & T) | { ok: false; message: string }

function fail(err: unknown): { ok: false; message: string } {
  if (err instanceof ActivityAdminError) return { ok: false, message: err.message }
  if (err instanceof ZodError) return { ok: false, message: err.errors[0]?.message ?? '輸入資料有誤' }
  console.error('[activity-admin]', err)
  return { ok: false, message: '系統忙碌中，請稍後再試' }
}

function refreshAll(activityId?: string) {
  revalidatePath('/admin/activities')
  if (activityId) revalidatePath(`/admin/activities/${activityId}`)
  revalidatePath('/booking')
  revalidatePath('/sessions')
  revalidatePath('/')
}

export async function previewActivityAction(input: unknown, activityId?: string | null): Promise<R<{ preview: PreviewResult }>> {
  try {
    await requireAdmin()
    return { ok: true, preview: await previewActivity(input, activityId) }
  } catch (err) {
    return fail(err)
  }
}

export async function saveActivityAction(params: {
  id?: string | null
  input: unknown
  mode: 'draft' | 'publish'
  excludeDates?: string[]
  holdDays?: number
}): Promise<R<{ result: SaveResult }>> {
  try {
    const admin = await requireAdmin()
    const result = await saveActivity({ ...params, actor: `admin:${admin}` })
    refreshAll(result.activityId)
    return { ok: true, result, message: result.message }
  } catch (err) {
    return fail(err)
  }
}

export async function previewSessionEditAction(input: unknown): Promise<R<{ rows: EditImpactRow[] }>> {
  try {
    await requireAdmin()
    return { ok: true, rows: await previewSessionEdit(input) }
  } catch (err) {
    return fail(err)
  }
}

export async function applySessionEditAction(
  input: unknown,
  confirmAffected: boolean,
  activityId?: string,
): Promise<R<{ applied: number; skipped: { sessionId: string; reason: string }[] }>> {
  try {
    const admin = await requireAdmin()
    const res = await applySessionEdit(input, { confirmAffected, actor: `admin:${admin}` })
    refreshAll(activityId)
    return {
      ok: true,
      applied: res.applied.length,
      skipped: res.skipped,
      message: `已修改 ${res.applied.length} 場${res.skipped.length > 0 ? `，${res.skipped.length} 場未修改` : ''}`,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function cancelSessionAction(
  sessionId: string,
  reason: string,
  activityId?: string,
): Promise<R<{ summary: Awaited<ReturnType<typeof cancelActivitySession>> }>> {
  try {
    const admin = await requireAdmin()
    const summary = await cancelActivitySession(sessionId, reason, `admin:${admin}`)
    refreshAll(activityId)
    revalidatePath(`/admin/sessions/${sessionId}`)
    const parts = ['已取消場次並釋放場地']
    if (summary.refunded > 0) parts.push(`退款 ${summary.refunded} 筆`)
    if (summary.toPoints > 0) parts.push(`其中 NT$${summary.toPoints.toLocaleString()} 以點數退還`)
    if (summary.pendingCancelled > 0) parts.push(`取消待付款訂單 ${summary.pendingCancelled} 筆`)
    return { ok: true, summary, message: parts.join('，') }
  } catch (err) {
    return fail(err)
  }
}

export async function archiveActivityAction(id: string): Promise<R<{ cancelled: number }>> {
  try {
    const admin = await requireAdmin()
    const res = await archiveActivity(id, `admin:${admin}`)
    refreshAll(id)
    return { ok: true, cancelled: res.cancelled, message: '已下架' }
  } catch (err) {
    return fail(err)
  }
}

export async function syncOccupancyAction(): Promise<R<Awaited<ReturnType<typeof syncLegacyOccupancy>>>> {
  try {
    await requireAdmin()
    const res = await syncLegacyOccupancy()
    refreshAll()
    return { ok: true, ...res }
  } catch (err) {
    return fail(err)
  }
}

export async function previewAddSessionAction(input: unknown): Promise<R<{ preview: Awaited<ReturnType<typeof previewAddSession>> }>> {
  try {
    await requireAdmin()
    return { ok: true, preview: await previewAddSession(input) }
  } catch (err) {
    return fail(err)
  }
}

export async function addSessionAction(input: unknown, activityId: string): Promise<R<{ sessionId: string }>> {
  try {
    const admin = await requireAdmin()
    const res = await addSession(input, `admin:${admin}`)
    refreshAll(activityId)
    return { ok: true, sessionId: res.sessionId, message: '已新增場次' }
  } catch (err) {
    return fail(err)
  }
}

export async function removeDraftSessionAction(sessionId: string, activityId: string): Promise<R<object>> {
  try {
    const admin = await requireAdmin()
    await removeDraftSession(sessionId, `admin:${admin}`)
    refreshAll(activityId)
    return { ok: true, message: '已移除未發布場次' }
  } catch (err) {
    return fail(err)
  }
}

export async function courtAvailabilityAction(params: { date: string; startMinute: number; endMinute: number; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; excludeSessionId?: string | null }): Promise<R<{ availability: Awaited<ReturnType<typeof courtAvailabilityForForm>> }>> {
  try {
    await requireAdmin()
    return { ok: true, availability: await courtAvailabilityForForm(params) }
  } catch (err) {
    return fail(err)
  }
}
