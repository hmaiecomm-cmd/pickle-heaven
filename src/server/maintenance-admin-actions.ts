'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { requirePermission } from '@/lib/admin-auth'
import {
  cancelMaintenanceEvent,
  cancelMaintenancePlan,
  createMaintenance,
  extendMaintenance,
  MaintenanceError,
  previewMaintenance,
  releaseMaintenanceEarly,
  setMaintenanceStatus,
} from './maintenance-admin'

type R<T> = ({ ok: true; message?: string } & T) | { ok: false; message: string }

const actor = async () => `admin:${(await requirePermission('courts.manage')).username}`

function fail(err: unknown): { ok: false; message: string } {
  if (err instanceof MaintenanceError) return { ok: false, message: err.message }
  if (err instanceof ZodError) return { ok: false, message: err.errors[0]?.message ?? '輸入資料有誤' }
  console.error('[maintenance-admin]', err)
  return { ok: false, message: '系統忙碌中，請稍後再試' }
}

function refresh() {
  revalidatePath('/admin/maintenance')
  revalidatePath('/admin/schedule')
  revalidatePath('/booking')
}

export async function previewMaintenanceAction(input: unknown): Promise<R<{ preview: Awaited<ReturnType<typeof previewMaintenance>> }>> {
  try {
    await actor()
    return { ok: true, preview: await previewMaintenance(input) }
  } catch (err) {
    return fail(err)
  }
}

export async function createMaintenanceAction(input: unknown, excludeDates: string[]): Promise<R<{ result: Awaited<ReturnType<typeof createMaintenance>> }>> {
  try {
    const a = await actor()
    const result = await createMaintenance({ input, excludeDates, actor: a })
    refresh()
    return { ok: true, result, message: result.message }
  } catch (err) {
    return fail(err)
  }
}

export async function maintenanceStatusAction(eventId: string, status: 'IN_PROGRESS' | 'DONE'): Promise<R<object>> {
  try {
    await setMaintenanceStatus(eventId, status, await actor())
    refresh()
    return { ok: true, message: status === 'DONE' ? '已標記完成（封場維持到原排定時間；要提前開放請按「提前解除封場」）' : '已開始' }
  } catch (err) {
    return fail(err)
  }
}

export async function maintenanceReleaseAction(eventId: string): Promise<R<{ released: number }>> {
  try {
    const r = await releaseMaintenanceEarly(eventId, await actor())
    refresh()
    return { ok: true, ...r, message: `已提前解除封場，釋放 ${r.released} 個時段格` }
  } catch (err) {
    return fail(err)
  }
}

export async function maintenanceExtendAction(eventId: string, newEndMinute: number): Promise<R<object>> {
  try {
    await extendMaintenance(eventId, newEndMinute, await actor())
    refresh()
    return { ok: true, message: '已延長封場時間' }
  } catch (err) {
    return fail(err)
  }
}

export async function maintenanceCancelAction(eventId: string, reason: string): Promise<R<object>> {
  try {
    await cancelMaintenanceEvent(eventId, reason, await actor())
    refresh()
    return { ok: true, message: '已取消這次排程並釋放場地' }
  } catch (err) {
    return fail(err)
  }
}

export async function maintenancePlanCancelAction(planId: string): Promise<R<{ cancelled: number }>> {
  try {
    const r = await cancelMaintenancePlan(planId, await actor())
    refresh()
    return { ok: true, ...r, message: `已取消整個排程（${r.cancelled} 次未來事件）` }
  } catch (err) {
    return fail(err)
  }
}
