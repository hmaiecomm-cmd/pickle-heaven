'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { PermissionError, requirePermission, type AdminContext } from '@/lib/admin-auth'
import type { Permission } from '@/lib/admin-permissions'
import {
  CameraError,
  getPlayback,
  recordSnapshot,
  testCameraConnection,
  updateCamera,
  type CameraAdminView,
  type CameraUpdateInput,
} from '@/server/camera-service'

/** 即時監控的伺服器動作：每一個都在伺服器端檢查權限，前端的按鈕隱藏只是輔助。 */

type R<T> = ({ ok: true } & T) | { ok: false; error: string }

async function guard<T>(permission: Permission, fn: (actor: string, ctx: AdminContext) => Promise<T>): Promise<R<{ data: T }>> {
  try {
    const ctx = await requirePermission(permission)
    return { ok: true, data: await fn(`admin:${ctx.username}`, ctx) }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有這項操作的權限' }
    if (err instanceof CameraError) return { ok: false, error: err.message }
    if (err instanceof ZodError) return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤' }
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[monitor]', err)
    return { ok: false, error: '系統忙碌中，請稍後再試' }
  }
}

export async function playbackAction(cameraId: string, date: string) {
  return guard('camera.playback', (_a, ctx) => getPlayback(cameraId, date, ctx.role))
}

/** 下載錄影：權限通過後才檢查是否有錄影；目前沒有 NVR，一律回報無錄影 */
export async function downloadClipAction(cameraId: string, date: string, time: string): Promise<R<{ data: never }>> {
  const r = await guard('camera.export', async (_a, ctx) => {
    await getPlayback(cameraId, date, ctx.role)
    return null
  })
  if (!r.ok) return r
  return { ok: false, error: `尚未串接錄影主機（NVR），${date} ${time} 沒有可下載的錄影。` }
}

/** 截圖：權限通過後寫入操作紀錄，由前端從目前畫面產生圖片（Demo 會加上「示範影像」浮水印） */
export async function snapshotAction(cameraId: string, at: string) {
  return guard('camera.export', (actor, ctx) => recordSnapshot(cameraId, ctx.role, actor, at))
}

export async function updateCameraAction(cameraId: string, input: CameraUpdateInput): Promise<R<{ data: CameraAdminView }>> {
  const r = await guard('camera.manage', (actor) => updateCamera(cameraId, input, actor))
  if (r.ok) revalidatePath('/admin/monitor')
  return r
}

export async function testCameraAction(cameraId: string) {
  return guard('camera.manage', (actor) => testCameraConnection(cameraId, actor))
}
