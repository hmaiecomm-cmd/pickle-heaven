'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/session'
import { joinSession, cancelRegistration } from './session-service'
import type { JoinRejection } from './session-service'

/**
 * 玩家端的球敘操作（規格 §13）。
 *
 * 真正的業務規則都在 session-service，這一層只負責取得登入者、
 * 把結果轉成給畫面看的訊息，並讓列表重新取得資料。
 */

export type SessionActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

const JOIN_MESSAGES: Record<JoinRejection, string> = {
  SESSION_NOT_FOUND: '找不到這場球敘',
  NOT_OPEN_YET: '報名尚未開放',
  BOOKING_CLOSED: '報名已截止',
  SESSION_LOCKED: '名單已鎖定，無法再報名',
  SESSION_CANCELLED: '這場球敘已取消',
  ALREADY_REGISTERED: '你已經報名過了',
  FULL_NO_WAITLIST: '已額滿，且這場沒有開放候補',
}

export async function joinSessionAction(sessionId: string): Promise<SessionActionResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: '請先登入' }

  const result = await joinSession(sessionId, user.id)
  revalidatePath('/sessions')

  if (!result.ok) return { ok: false, message: JOIN_MESSAGES[result.reason] }

  return result.status === 'CONFIRMED'
    ? { ok: true, message: '報名成功！' }
    : { ok: true, message: `已加入候補，目前順位 #${result.position}` }
}

export async function cancelSessionAction(sessionId: string): Promise<SessionActionResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, message: '請先登入' }

  const result = await cancelRegistration(sessionId, user.id)
  revalidatePath('/sessions')

  if (!result.ok) {
    const messages = {
      NOT_REGISTERED: '你並未報名這場球敘',
      SESSION_NOT_FOUND: '找不到這場球敘',
      ALREADY_CANCELLED: '你已經取消過了',
    }
    return { ok: false, message: messages[result.reason] }
  }

  if (result.status === 'LATE_CANCEL') {
    return { ok: true, message: '已取消。由於已過取消期限，這次會記為逾時取消。' }
  }
  return { ok: true, message: '已取消報名' }
}
